import { copy, uid, type PracticeRoutine } from './model.ts';
import { creditDays, localDay, type FreePractice } from './practiceTime.ts';

export type BlockState = 'pending' | 'active' | 'completed' | 'skipped' | 'partial';
export interface BlockResult {
  blockId: string;
  name: string;
  activeMs: number;
  bpm: number;
  state: BlockState;
}
export interface PracticeSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  routine: PracticeRoutine;
  blockIndex: number;
  phase: 'count-in' | 'exercise' | 'break' | 'confirm' | 'finished';
  phaseElapsedMs: number;
  anchorMs: number | null;
  autoAdvance: boolean;
  countIn: boolean;
  practiceEnabled: boolean;
  dailyMs: Record<string, number>;
  results: BlockResult[];
  notice: string | null;
}
export function createSession(
  routine: PracticeRoutine,
  now: number,
  autoAdvance = true,
  countIn = true,
): PracticeSession {
  return {
    id: uid(),
    startedAt: new Date(now).toISOString(),
    endedAt: null,
    routine: copy(routine),
    blockIndex: 0,
    phase: countIn ? 'count-in' : 'exercise',
    phaseElapsedMs: 0,
    anchorMs: now,
    autoAdvance,
    countIn,
    practiceEnabled: true,
    dailyMs: {},
    results: routine.blocks.map((b, i) => ({
      blockId: b.id,
      name: b.name,
      activeMs: 0,
      bpm: b.bpm,
      state: i === 0 ? 'active' : 'pending',
    })),
    notice: null,
  };
}
export function phaseDuration(session: PracticeSession) {
  const b = session.routine.blocks[session.blockIndex]!;
  return session.phase === 'count-in'
    ? (b.pattern.beatsPerBar * 60000) / b.bpm
    : session.phase === 'break'
      ? b.breakSeconds * 1000
      : b.durationSeconds * 1000;
}
function nextBlock(session: PracticeSession, now: number) {
  if (session.blockIndex + 1 >= session.routine.blocks.length) {
    session.phase = 'finished';
    session.anchorMs = null;
    session.endedAt = new Date(now).toISOString();
    session.notice = 'Routine finished. Your practice has been saved.';
  } else {
    session.blockIndex++;
    session.phase = session.countIn ? 'count-in' : 'exercise';
    session.results[session.blockIndex]!.state = 'active';
  }
  session.phaseElapsedMs = 0;
}
/** Timestamp-based reconciliation, including delayed ticks across multiple phase boundaries.
 * Never credits count-ins, breaks, confirmation waits, pauses, or skipped duration. */
export function advanceSession(previous: PracticeSession, now: number): PracticeSession {
  if (
    previous.anchorMs === null ||
    now <= previous.anchorMs ||
    previous.phase === 'finished' ||
    previous.phase === 'confirm'
  )
    return previous;
  const s = copy(previous);
  let remaining = now - s.anchorMs!;
  s.anchorMs = now;
  while (remaining > 0 && s.phase !== 'finished' && s.phase !== 'confirm') {
    const used = Math.min(remaining, Math.max(0, phaseDuration(s) - s.phaseElapsedMs));
    s.phaseElapsedMs += used;
    remaining -= used;
    if (s.phase === 'exercise' && s.practiceEnabled) {
      s.results[s.blockIndex]!.activeMs += used;
      s.dailyMs = creditDays(s.dailyMs, now - remaining - used, now - remaining);
    }
    if (s.phaseElapsedMs < phaseDuration(s)) break;
    s.phaseElapsedMs = 0;
    if (s.phase === 'count-in') s.phase = 'exercise';
    else if (s.phase === 'exercise') {
      s.results[s.blockIndex]!.state = 'completed';
      s.notice = `${s.routine.blocks[s.blockIndex]!.name} complete.`;
      if (!s.autoAdvance) {
        s.phase = 'confirm';
        s.anchorMs = null;
      } else if (s.routine.blocks[s.blockIndex]!.breakSeconds > 0) s.phase = 'break';
      else nextBlock(s, now - remaining);
    } else nextBlock(s, now - remaining);
  }
  return s;
}
export function setSessionPractice(
  session: PracticeSession,
  now: number,
  practiceEnabled: boolean,
) {
  return { ...advanceSession(session, now), practiceEnabled };
}
export function pauseSession(session: PracticeSession, now: number, notice?: string) {
  const s = { ...advanceSession(session, now), anchorMs: null };
  if (notice) s.notice = notice;
  return s;
}
export function resumeSession(session: PracticeSession, now: number) {
  if (session.phase === 'finished' || session.phase === 'confirm' || session.anchorMs !== null)
    return session;
  return { ...session, anchorMs: now, notice: null };
}
export function confirmSession(session: PracticeSession, now: number) {
  if (session.phase !== 'confirm') return session;
  const s = copy(session);
  s.anchorMs = now;
  s.phaseElapsedMs = 0;
  s.notice = null;
  if (s.routine.blocks[s.blockIndex]!.breakSeconds > 0) s.phase = 'break';
  else nextBlock(s, now);
  return s;
}
export function skipBlock(session: PracticeSession, now: number) {
  const s = copy(advanceSession(session, now));
  if (s.phase === 'finished') return s;
  const running = s.anchorMs !== null;
  if (s.results[s.blockIndex]!.state !== 'completed') s.results[s.blockIndex]!.state = 'skipped';
  nextBlock(s, now);
  if (!running) s.anchorMs = null;
  return s;
}
export function endSession(session: PracticeSession, now: number) {
  const s = copy(pauseSession(session, now));
  for (const result of s.results)
    if (result.state === 'active') result.state = result.activeMs > 0 ? 'partial' : 'pending';
  s.phase = 'finished';
  s.endedAt = new Date(now).toISOString();
  return s;
}
export function activeMs(session: PracticeSession) {
  return session.results.reduce((sum, r) => sum + r.activeMs, 0);
}
export function weeklySummary(
  sessions: PracticeSession[],
  now = new Date(),
  freePractice: FreePractice[] = [],
) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    return {
      date,
      activeMs:
        sessions.reduce((sum, s) => sum + (s.dailyMs[localDay(date.getTime())] ?? 0), 0) +
        freePractice.reduce((sum, s) => sum + (s.dailyMs[localDay(date.getTime())] ?? 0), 0),
    };
  });
  return {
    days,
    weekMs: days.reduce((sum, d) => sum + d.activeMs, 0),
    totalMs:
      sessions.reduce((sum, s) => sum + activeMs(s), 0) +
      freePractice.reduce((sum, s) => sum + s.activeMs, 0),
  };
}
