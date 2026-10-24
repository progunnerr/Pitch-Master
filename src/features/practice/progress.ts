import { PRACTICE_KINDS, type PracticeKind, type PracticeRound } from './exercises.ts';

export const PROGRESS_KEY = '@pitch-master/practice/v1';
const MAX_COUNTER = 1_000_000;
export interface PracticeStats {
  completed: number;
  firstTryCorrect: number;
  assisted: number;
  revealed: number;
  answers: number;
  streak: number;
  bestStreak: number;
  lastPracticedAt: string | null;
}
export interface PracticeProgress {
  version: 1;
  modes: Record<PracticeKind, PracticeStats>;
  recentRoundIds: string[];
}
export interface RoundResult {
  id: string;
  kind: PracticeKind;
  attempts: number;
  assisted: boolean;
  revealed: boolean;
  at: string;
}
const emptyStats = (): PracticeStats => ({
  completed: 0,
  firstTryCorrect: 0,
  assisted: 0,
  revealed: 0,
  answers: 0,
  streak: 0,
  bestStreak: 0,
  lastPracticedAt: null,
});
export function emptyProgress(): PracticeProgress {
  return {
    version: 1,
    modes: {
      tonic: emptyStats(),
      interval: emptyStats(),
      sargam: emptyStats(),
      movableDo: emptyStats(),
    },
    recentRoundIds: [],
  };
}
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, MAX_COUNTER)
    : 0;
export function decodeProgress(raw: string | null): PracticeProgress {
  const output = emptyProgress();
  if (!raw) return output;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return output;
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('modes' in value) ||
    !value.modes ||
    typeof value.modes !== 'object'
  )
    return output;
  const modes = value.modes as Record<string, unknown>;
  for (const kind of PRACTICE_KINDS) {
    const saved = modes[kind];
    if (!saved || typeof saved !== 'object') continue;
    const s = saved as Record<string, unknown>;
    const completed = count(s.completed);
    const firstTryCorrect = Math.min(count(s.firstTryCorrect), completed);
    const streak = Math.min(count(s.streak), firstTryCorrect);
    output.modes[kind] = {
      completed,
      firstTryCorrect,
      assisted: Math.min(count(s.assisted), completed),
      revealed: Math.min(count(s.revealed), completed),
      answers: count(s.answers),
      streak,
      bestStreak: Math.min(Math.max(count(s.bestStreak), streak), firstTryCorrect),
      lastPracticedAt:
        typeof s.lastPracticedAt === 'string' &&
        s.lastPracticedAt.length <= 40 &&
        Number.isFinite(Date.parse(s.lastPracticedAt))
          ? s.lastPracticedAt
          : null,
    };
  }
  if ('recentRoundIds' in value && Array.isArray(value.recentRoundIds))
    output.recentRoundIds = [
      ...new Set(
        value.recentRoundIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128,
        ),
      ),
    ].slice(-128);
  return output;
}

export function roundResult(round: PracticeRound, at: string): RoundResult | null {
  if (round.status === 'open') return null;
  return {
    id: round.question.id,
    kind: round.question.kind,
    attempts: round.wrongAnswers.length + (round.status === 'correct' ? 1 : 0),
    assisted: round.assisted,
    revealed: round.status === 'revealed',
    at,
  };
}

export function recordResult(progress: PracticeProgress, result: RoundResult): PracticeProgress {
  if (progress.recentRoundIds.includes(result.id)) return progress;
  const previous = progress.modes[result.kind];
  const win = result.attempts === 1 && !result.assisted && !result.revealed;
  const streak = win ? count(previous.streak + 1) : 0;
  return {
    version: 1,
    modes: {
      ...progress.modes,
      [result.kind]: {
        completed: count(previous.completed + 1),
        firstTryCorrect: count(previous.firstTryCorrect + (win ? 1 : 0)),
        assisted: count(previous.assisted + (result.assisted ? 1 : 0)),
        revealed: count(previous.revealed + (result.revealed ? 1 : 0)),
        answers: count(previous.answers + result.attempts),
        streak,
        bestStreak: Math.max(previous.bestStreak, streak),
        lastPracticedAt: result.at,
      },
    },
    recentRoundIds: [...progress.recentRoundIds, result.id].slice(-128),
  };
}

export function progressTotals(progress: PracticeProgress) {
  return PRACTICE_KINDS.reduce(
    (total, kind) => ({
      completed: total.completed + progress.modes[kind].completed,
      firstTryCorrect: total.firstTryCorrect + progress.modes[kind].firstTryCorrect,
      bestStreak: Math.max(total.bestStreak, progress.modes[kind].bestStreak),
    }),
    { completed: 0, firstTryCorrect: 0, bestStreak: 0 },
  );
}
