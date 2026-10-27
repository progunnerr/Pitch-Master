export type StrumAction = 'down' | 'up' | 'mute' | 'rest';
export const ACTIONS: Record<StrumAction, { symbol: string; label: string }> = {
  down: { symbol: '↓', label: 'Down' },
  up: { symbol: '↑', label: 'Up' },
  mute: { symbol: '×', label: 'Mute' },
  rest: { symbol: '–', label: 'Rest' },
};
export interface StrumPattern {
  id: string;
  name: string;
  beatsPerBar: number;
  bars: number;
  subdivision: number;
  // Beat offsets are independent of actions; an upstroke need not be an offbeat.
  events: { id: string; action: StrumAction; beat: number }[];
}
/** Use the selected count grid while retaining every actual strum position. */
export function patternTimeline(pattern: StrumPattern, subdivision = pattern.subdivision) {
  const length = pattern.beatsPerBar * pattern.bars;
  const positions = [
    ...new Set([
      ...Array.from({ length: length * subdivision }, (_, i) => i / subdivision),
      ...pattern.events.filter((e) => e.beat >= 0 && e.beat < length).map((e) => e.beat),
    ]),
  ].sort((a, b) => a - b);
  return positions.map((beat, i) => ({
    beat,
    counted: Math.abs(beat * subdivision - Math.round(beat * subdivision)) < 0.0001,
    end: positions[i + 1] ?? length,
    events: pattern.events.filter((e) => e.beat === beat),
  }));
}
export type Finger = '1' | '2' | '3' | '4' | 'T' | null;
export interface ChordString {
  string: number;
  fret: number | null; // null = muted, zero = open
  finger: Finger;
}
export interface GuitarChord {
  id: 'G' | 'D';
  name: string;
  strings: ChordString[];
}
export interface ChordStep {
  chordId: 'G' | 'D';
  bars: number;
}
export type ExerciseType = 'strumming' | 'transitions' | 'combined';
export interface ExerciseBlock {
  id: string;
  name: string;
  type: ExerciseType;
  durationSeconds: number;
  bpm: number;
  pattern: StrumPattern;
  progression: ChordStep[];
  breakSeconds: number;
}
export interface PracticeRoutine {
  id: string;
  name: string;
  blocks: ExerciseBlock[];
}
export const PRESET_PATTERNS: StrumPattern[] = [
  {
    id: 'pattern-1',
    name: 'Pattern 1',
    beatsPerBar: 4,
    bars: 1,
    subdivision: 2,
    events: ['down', 'up', 'down', 'up'].map((action, i) => ({
      id: `p1-${i}`,
      action: action as StrumAction,
      beat: i,
    })),
  },
  {
    id: 'pattern-2',
    name: 'Pattern 2',
    beatsPerBar: 4,
    bars: 1,
    subdivision: 2,
    events: ['down', 'up', 'mute', 'up'].map((action, i) => ({
      id: `p2-${i}`,
      action: action as StrumAction,
      beat: i,
    })),
  },
];
export const DEFAULT_CHORDS: GuitarChord[] = [
  {
    id: 'G',
    name: 'G major',
    strings: [
      { string: 6, fret: 3, finger: '2' },
      { string: 5, fret: 2, finger: '1' },
      { string: 4, fret: 0, finger: null },
      { string: 3, fret: 0, finger: null },
      { string: 2, fret: 3, finger: '3' },
      { string: 1, fret: 3, finger: '4' },
    ],
  },
  {
    id: 'D',
    name: 'D major',
    strings: [
      { string: 6, fret: null, finger: null },
      { string: 5, fret: null, finger: null },
      { string: 4, fret: 0, finger: null },
      { string: 3, fret: 2, finger: '1' },
      { string: 2, fret: 3, finger: '3' },
      { string: 1, fret: 2, finger: '2' },
    ],
  },
];
export const DEFAULT_PROGRESSION: ChordStep[] = [
  { chordId: 'G', bars: 1 },
  { chordId: 'D', bars: 1 },
];
export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
export function newBlock(pattern = PRESET_PATTERNS[0]!): ExerciseBlock {
  return {
    id: uid(),
    name: pattern.name,
    type: 'strumming',
    durationSeconds: 300,
    bpm: 80,
    pattern: copy(pattern),
    progression: copy(DEFAULT_PROGRESSION),
    breakSeconds: 0,
  };
}
export function defaultRoutine(): PracticeRoutine {
  return {
    id: 'daily-strumming',
    name: 'Daily Strumming Practice',
    blocks: PRESET_PATTERNS.map((pattern, i) => ({
      ...newBlock(pattern),
      id: `daily-${i}`,
      name: i === 0 ? 'Down, Up, Down, Up' : 'Down, Up, Mute, Up',
      durationSeconds: 900,
    })),
  };
}
export function routineSeconds(routine: PracticeRoutine) {
  return routine.blocks.reduce((sum, b) => sum + b.durationSeconds, 0);
}
export function clockTime(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
export function chordAt(progression: ChordStep[], beat: number, beatsPerBar: number) {
  const total = progression.reduce((sum, step) => sum + step.bars, 0);
  const bar = Math.floor(Math.max(0, beat) / beatsPerBar) % total;
  let end = 0;
  return (
    progression.find((step) => {
      end += step.bars;
      return bar < end;
    }) ?? progression[0]
  );
}
export function patternError(pattern: StrumPattern): string | null {
  if (!pattern.name.trim()) return 'Give the pattern a name.';
  if (
    ![2, 3, 4, 6].includes(pattern.beatsPerBar) ||
    ![1, 2, 4].includes(pattern.bars) ||
    ![1, 2, 3, 4].includes(pattern.subdivision)
  )
    return 'Choose a supported meter and subdivision.';
  if (!pattern.events.length || pattern.events.length > 96)
    return 'Add at least one action (up to 96).';
  const positions = new Set<number>();
  for (const event of pattern.events) {
    if (
      !Object.hasOwn(ACTIONS, event.action) ||
      !Number.isFinite(event.beat) ||
      event.beat < 0 ||
      event.beat >= pattern.beatsPerBar * pattern.bars
    )
      return 'Place every action inside the pattern.';
    if (positions.has(event.beat)) return 'Use one action per position.';
    positions.add(event.beat);
  }
  return null;
}
export function routineError(routine: PracticeRoutine): string | null {
  if (!routine.name.trim()) return 'Give the routine a name.';
  if (!routine.blocks.length || routine.blocks.length > 40)
    return 'Add between 1 and 40 exercises.';
  for (const block of routine.blocks) {
    if (!block.name.trim()) return 'Give every exercise a name.';
    if (!['strumming', 'transitions', 'combined'].includes(block.type))
      return 'Choose an exercise type.';
    if (
      !Number.isFinite(block.durationSeconds) ||
      block.durationSeconds < 1 ||
      block.durationSeconds > 7200
    )
      return 'Each duration must be between 1 second and 120 minutes.';
    if (!Number.isFinite(block.bpm) || block.bpm < 40 || block.bpm > 160)
      return 'BPM must be between 40 and 160.';
    if (!Number.isFinite(block.breakSeconds) || block.breakSeconds < 0 || block.breakSeconds > 1800)
      return 'Breaks must be between 0 and 30 minutes.';
    if (
      !block.progression.length ||
      block.progression.length > 16 ||
      block.progression.some(
        (s) =>
          !['G', 'D'].includes(s.chordId) || !Number.isInteger(s.bars) || s.bars < 1 || s.bars > 16,
      )
    )
      return 'Chord steps need 1–16 bars each.';
    const error = patternError(block.pattern);
    if (error) return error;
  }
  return null;
}
