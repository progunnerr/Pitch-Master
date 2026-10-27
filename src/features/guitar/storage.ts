import {
  copy,
  DEFAULT_CHORDS,
  defaultRoutine,
  patternError,
  PRESET_PATTERNS,
  routineError,
  type GuitarChord,
  type PracticeRoutine,
  type StrumPattern,
} from './model.ts';
import type { PracticeSession } from './session.ts';
import { activeMs } from './session.ts';
import { decodeMetronome, DEFAULT_METRONOME, type MetronomeSettings } from './metronome.ts';
import { localDay, type FreePractice } from './practiceTime.ts';

export const GUITAR_STORAGE_KEY = 'pitch-master:guitar-studio:v1';
export interface StudioData {
  version: 1;
  routines: PracticeRoutine[];
  patterns: StrumPattern[];
  chords: GuitarChord[];
  sessions: PracticeSession[];
  freePractice: FreePractice[];
  metronome: MetronomeSettings;
  activeId: string | null;
  settings: { autoAdvance: boolean; countIn: boolean; metronome: boolean };
}
export function emptyStudio(): StudioData {
  return {
    version: 1,
    routines: [defaultRoutine()],
    patterns: copy(PRESET_PATTERNS),
    chords: copy(DEFAULT_CHORDS),
    sessions: [],
    freePractice: [],
    metronome: { ...DEFAULT_METRONOME },
    activeId: null,
    settings: { autoAdvance: true, countIn: true, metronome: true },
  };
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function text(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
}
export function validPattern(value: unknown): value is StrumPattern {
  try {
    if (
      !record(value) ||
      !text(value.id) ||
      !text(value.name) ||
      !Array.isArray(value.events) ||
      !value.events.every((e) => record(e) && text(e.id))
    )
      return false;
    return patternError(value as unknown as StrumPattern) === null;
  } catch {
    return false;
  }
}
export function validRoutine(value: unknown): value is PracticeRoutine {
  try {
    if (!record(value) || !text(value.id) || !text(value.name) || !Array.isArray(value.blocks))
      return false;
    if (
      !value.blocks.every((b) => record(b) && text(b.id) && text(b.name) && validPattern(b.pattern))
    )
      return false;
    if (new Set(value.blocks.map((b) => (b as { id: string }).id)).size !== value.blocks.length)
      return false;
    return routineError(value as unknown as PracticeRoutine) === null;
  } catch {
    return false;
  }
}
function validChord(value: unknown): value is GuitarChord {
  if (
    !record(value) ||
    !['G', 'D'].includes(String(value.id)) ||
    !text(value.name) ||
    !Array.isArray(value.strings) ||
    value.strings.length !== 6
  )
    return false;
  return value.strings.every(
    (s, i) =>
      record(s) &&
      s.string === 6 - i &&
      (s.fret === null ||
        (Number.isInteger(s.fret) && Number(s.fret) >= 0 && Number(s.fret) <= 12)) &&
      [null, '1', '2', '3', '4', 'T'].includes(s.finger as null | string),
  );
}
function validSession(value: unknown): value is PracticeSession {
  if (
    !record(value) ||
    !text(value.id) ||
    typeof value.startedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.startedAt)) ||
    !validRoutine(value.routine)
  )
    return false;
  if (
    value.endedAt !== null &&
    (typeof value.endedAt !== 'string' || !Number.isFinite(Date.parse(value.endedAt)))
  )
    return false;
  if (
    !Number.isInteger(value.blockIndex) ||
    Number(value.blockIndex) < 0 ||
    Number(value.blockIndex) >= value.routine.blocks.length
  )
    return false;
  if (
    !['count-in', 'exercise', 'break', 'confirm', 'finished'].includes(String(value.phase)) ||
    typeof value.countIn !== 'boolean' ||
    typeof value.autoAdvance !== 'boolean'
  )
    return false;
  if (
    typeof value.phaseElapsedMs !== 'number' ||
    !Number.isFinite(value.phaseElapsedMs) ||
    value.phaseElapsedMs < 0 ||
    value.phaseElapsedMs > 7200000
  )
    return false;
  if (
    value.anchorMs !== null &&
    (typeof value.anchorMs !== 'number' || !Number.isFinite(value.anchorMs))
  )
    return false;
  if (value.notice !== null && typeof value.notice !== 'string') return false;
  const blocks = value.routine.blocks;
  return (
    Array.isArray(value.results) &&
    value.results.length === blocks.length &&
    value.results.every(
      (r, i) =>
        record(r) &&
        r.blockId === blocks[i]!.id &&
        text(r.name) &&
        r.bpm === blocks[i]!.bpm &&
        typeof r.activeMs === 'number' &&
        Number.isFinite(r.activeMs) &&
        r.activeMs >= 0 &&
        r.activeMs <= blocks[i]!.durationSeconds * 1000 &&
        ['pending', 'active', 'completed', 'skipped', 'partial'].includes(String(r.state)),
    )
  );
}
export function decodeStudio(raw: string | null): StudioData {
  if (raw === null) return emptyStudio();
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.routines) ||
    !Array.isArray(value.sessions)
  )
    throw new Error('Unrecognized studio data');
  const defaults = emptyStudio();
  const sessions = value.sessions.filter(validSession).map((s) => ({
    ...s,
    practiceEnabled: s.practiceEnabled !== false,
    dailyMs: validDailyMs(s.dailyMs, activeMs(s))
      ? s.dailyMs
      : { [localDay(Date.parse(s.startedAt))]: activeMs(s) },
    anchorMs: null,
    notice:
      s.phase !== 'finished' ? 'Session restored and paused. Resume when you’re ready.' : s.notice,
  }));
  return {
    ...defaults,
    routines: value.routines.filter(validRoutine),
    patterns: Array.isArray(value.patterns)
      ? value.patterns.filter(validPattern)
      : defaults.patterns,
    chords: defaults.chords.map((c) =>
      Array.isArray(value.chords)
        ? ((value.chords.find((v) => validChord(v) && v.id === c.id) as GuitarChord) ?? c)
        : c,
    ),
    sessions,
    freePractice: Array.isArray(value.freePractice)
      ? value.freePractice.filter(validFreePractice)
      : [],
    metronome: decodeMetronome(value.metronome),
    activeId:
      typeof value.activeId === 'string' &&
      sessions.some((s) => s.id === value.activeId && s.phase !== 'finished')
        ? value.activeId
        : null,
    settings: record(value.settings)
      ? {
          autoAdvance: value.settings.autoAdvance !== false,
          countIn: value.settings.countIn !== false,
          metronome: value.settings.metronome !== false,
        }
      : defaults.settings,
  };
}
function validDailyMs(value: unknown, total: number): value is Record<string, number> {
  if (!record(value)) return false;
  let sum = 0;
  for (const [key, ms] of Object.entries(value)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
      typeof ms !== 'number' ||
      !Number.isFinite(ms) ||
      ms < 0
    )
      return false;
    sum += ms;
  }
  return Math.abs(sum - total) < 1;
}
function validFreePractice(value: unknown): value is FreePractice {
  return (
    record(value) &&
    text(value.id) &&
    typeof value.startedAt === 'string' &&
    Number.isFinite(Date.parse(value.startedAt)) &&
    typeof value.activeMs === 'number' &&
    Number.isFinite(value.activeMs) &&
    value.activeMs >= 0 &&
    validDailyMs(value.dailyMs, value.activeMs)
  );
}
export function saveFreePractice(data: StudioData, practice: FreePractice): StudioData {
  if (practice.activeMs <= 0) return data;
  return {
    ...data,
    freePractice: [practice, ...data.freePractice.filter((s) => s.id !== practice.id)],
  };
}
/** Routine results and free practice are distinct sources; each checkpoint is upserted. */
export function studioDayMs(data: StudioData, day = localDay(Date.now())) {
  return (
    data.freePractice.reduce((sum, s) => sum + (s.dailyMs[day] ?? 0), 0) +
    data.sessions.reduce((sum, s) => sum + (s.dailyMs[day] ?? 0), 0)
  );
}
export function saveSession(data: StudioData, session: PracticeSession): StudioData {
  return {
    ...data,
    activeId: session.phase === 'finished' ? null : session.id,
    sessions: [session, ...data.sessions.filter((s) => s.id !== session.id)],
  };
}
