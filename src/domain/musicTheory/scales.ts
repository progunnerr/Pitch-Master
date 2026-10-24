// Intervals are semitone distances from the tonic. Descending melodic minor uses natural minor.
export const SCALES = {
  major: {
    name: 'Major',
    ascending: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
  },
  naturalMinor: {
    name: 'Natural minor',
    ascending: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'],
  },
  harmonicMinor: {
    name: 'Harmonic minor',
    ascending: [0, 2, 3, 5, 7, 8, 11],
    degrees: ['1', '2', '♭3', '4', '5', '♭6', '7'],
  },
  melodicMinor: {
    name: 'Melodic minor',
    ascending: [0, 2, 3, 5, 7, 9, 11],
    descending: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['1', '2', '♭3', '4', '5', '6', '7'],
    descendingDegrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'],
  },
  majorPentatonic: {
    name: 'Major pentatonic',
    ascending: [0, 2, 4, 7, 9],
    degrees: ['1', '2', '3', '5', '6'],
  },
  minorPentatonic: {
    name: 'Minor pentatonic',
    ascending: [0, 3, 5, 7, 10],
    degrees: ['1', '♭3', '4', '5', '♭7'],
  },
  majorBlues: {
    name: 'Major blues',
    ascending: [0, 2, 3, 4, 7, 9],
    degrees: ['1', '2', '♭3', '3', '5', '6'],
  },
  minorBlues: {
    name: 'Minor blues',
    ascending: [0, 3, 5, 6, 7, 10],
    degrees: ['1', '♭3', '4', '♭5', '5', '♭7'],
  },
  chromatic: {
    name: 'Chromatic',
    ascending: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    degrees: ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'],
  },
} as const;

export type ScaleId = keyof typeof SCALES;
export type Direction = 'ascending' | 'descending';

export function scaleIntervals(
  scale: ScaleId,
  direction: Direction = 'ascending',
): readonly number[] {
  const definition = SCALES[scale];
  return direction === 'descending' && 'descending' in definition
    ? definition.descending
    : definition.ascending;
}

export function scaleDegrees(
  scale: ScaleId,
  direction: Direction = 'ascending',
): readonly string[] {
  const definition = SCALES[scale];
  return direction === 'descending' && 'descendingDegrees' in definition
    ? definition.descendingDegrees
    : definition.degrees;
}

export function scaleSteps(scale: ScaleId, direction: Direction = 'ascending'): number[] {
  const intervals = [...scaleIntervals(scale, direction), 12];
  const steps = intervals.slice(1).map((interval, index) => interval - intervals[index]!);
  return direction === 'descending' ? steps.reverse() : steps;
}

export function isInScale(
  pitch: number,
  tonic: number,
  scale: ScaleId,
  direction: Direction = 'ascending',
): boolean {
  const interval = (((pitch - tonic) % 12) + 12) % 12;
  return scaleIntervals(scale, direction).includes(interval);
}

export function scaleDegree(
  interval: number,
  scale: ScaleId,
  direction: Direction = 'ascending',
): string | undefined {
  const semitone = ((interval % 12) + 12) % 12;
  return scaleDegrees(scale, direction)[scaleIntervals(scale, direction).indexOf(semitone)];
}

export function scalePitches(
  tonic: number,
  scale: ScaleId,
  direction: Direction = 'ascending',
): number[] {
  const pitches = [...scaleIntervals(scale, direction), 12].map((interval) => tonic + interval);
  return direction === 'descending' ? pitches.reverse() : pitches;
}

export function scaleMidiNotes(
  tonic: number,
  octave: number,
  scale: ScaleId,
  direction: Direction = 'ascending',
): number[] {
  return scalePitches(tonic, scale, direction).map((pitch) => (octave + 1) * 12 + pitch);
}
