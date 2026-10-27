import { scaleDegree, type Direction, type ScaleId } from './scales.ts';

export type Notation = 'solfege' | 'sargam' | 'degrees';
export type SargamLanguage = 'english' | 'hindi';
export type Accidentals = 'sharps' | 'flats';

export const PITCH_CLASSES = Array.from({ length: 12 }, (_, index) => index);
const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;
const SOLFEGE_SHARPS = [
  'Do',
  'Di',
  'Re',
  'Ri',
  'Mi',
  'Fa',
  'Fi',
  'Sol',
  'Si',
  'La',
  'Li',
  'Ti',
] as const;
const SOLFEGE_FLATS = [
  'Do',
  'Ra',
  'Re',
  'Me',
  'Mi',
  'Fa',
  'Se',
  'Sol',
  'Le',
  'La',
  'Te',
  'Ti',
] as const;
// Combining low lines and a vertical line above keep traditional marks attached
// to the syllable in wheel labels, inline formulas, and copied text.
const SARGAM = [
  'Sa',
  'R\u0332e\u0332',
  'Re',
  'G\u0332a\u0332',
  'Ga',
  'Ma',
  'M\u030Da',
  'Pa',
  'D\u0332h\u0332a\u0332',
  'Dha',
  'N\u0332i\u0332',
  'Ni',
] as const;
const SARGAM_HINDI = [
  'सा',
  'रे\u0332',
  'रे',
  'गा\u0332',
  'गा',
  'मा',
  'मा\u030D',
  'पा',
  'धा\u0332',
  'धा',
  'नी\u0332',
  'नी',
] as const;
const SARGAM_FULL_HINDI = [
  'सा',
  'कोमल रे',
  'शुद्ध रे',
  'कोमल गा',
  'शुद्ध गा',
  'शुद्ध मा',
  'तीव्र मा',
  'पा',
  'कोमल धा',
  'शुद्ध धा',
  'कोमल नी',
  'शुद्ध नी',
] as const;
const SARGAM_FULL = [
  'Sa',
  'komal Re',
  'shuddha Re',
  'komal Ga',
  'shuddha Ga',
  'shuddha Ma',
  'tivra Ma',
  'Pa',
  'komal Dha',
  'shuddha Dha',
  'komal Ni',
  'shuddha Ni',
] as const;
export const DEGREES = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'] as const;
export const INTERVALS = [
  'Unison',
  'Minor second',
  'Major second',
  'Minor third',
  'Major third',
  'Perfect fourth',
  'Tritone',
  'Perfect fifth',
  'Minor sixth',
  'Major sixth',
  'Minor seventh',
  'Major seventh',
] as const;

export function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function noteName(pitch: number, accidentals: Accidentals = 'sharps'): string {
  return (accidentals === 'sharps' ? SHARPS : FLATS)[mod12(pitch)]!;
}

export function relativeSemitone(pitch: number, tonic: number): number {
  return mod12(pitch - tonic);
}

export function absolutePitch(tonic: number, interval: number): number {
  return mod12(tonic + interval);
}

export function relativeName(
  interval: number,
  notation: Notation,
  convention: Accidentals = 'sharps',
  sargamLanguage: SargamLanguage = 'english',
): string {
  const index = mod12(interval);
  if (notation === 'sargam') return (sargamLanguage === 'hindi' ? SARGAM_HINDI : SARGAM)[index]!;
  if (notation === 'degrees') return DEGREES[index]!;
  return (convention === 'sharps' ? SOLFEGE_SHARPS : SOLFEGE_FLATS)[index]!;
}

export function relativeDescription(
  interval: number,
  notation: Notation,
  convention: Accidentals = 'sharps',
  sargamLanguage: SargamLanguage = 'english',
): string {
  return notation === 'sargam'
    ? (sargamLanguage === 'hindi' ? SARGAM_FULL_HINDI : SARGAM_FULL)[mod12(interval)]!
    : relativeName(interval, notation, convention, sargamLanguage);
}

export function midiNote(pitch: number, octave: number): number {
  return (octave + 1) * 12 + mod12(pitch);
}

export function frequency(pitch: number, octave = 4, concertA = 440): number {
  if (!Number.isFinite(concertA) || concertA <= 0)
    throw new RangeError('Concert A must be a positive frequency.');
  return concertA * 2 ** ((midiNote(pitch, octave) - 69) / 12);
}

export function tonicRelationship(
  tonic: number,
  accidentals: Accidentals,
  sargamLanguage: SargamLanguage = 'english',
): string {
  return `${noteName(tonic, accidentals)} = ${relativeName(0, 'sargam', 'sharps', sargamLanguage)} = Do = 1`;
}

const DEGREE_SOLFEGE: Record<string, string> = {
  '1': 'Do',
  '♭2': 'Ra',
  '2': 'Re',
  '♭3': 'Me',
  '3': 'Mi',
  '4': 'Fa',
  '♯4': 'Fi',
  '♭5': 'Se',
  '5': 'Sol',
  '♭6': 'Le',
  '6': 'La',
  '♭7': 'Te',
  '7': 'Ti',
};

export function scaleRelativeName(
  interval: number,
  notation: Notation,
  scale: ScaleId,
  direction: Direction,
  convention: Accidentals = 'sharps',
  sargamLanguage: SargamLanguage = 'english',
): string {
  const degree = scaleDegree(interval, scale, direction);
  if (notation === 'degrees' && degree) return degree;
  if (notation === 'solfege' && scale !== 'chromatic' && degree) return DEGREE_SOLFEGE[degree]!;
  return relativeName(interval, notation, convention, sargamLanguage);
}

export {
  SCALES,
  scalePitches,
  scaleIntervals,
  scaleDegrees,
  scaleSteps,
  scaleDegree,
  scaleMidiNotes,
  isInScale,
  type ScaleId,
  type Direction,
} from './scales.ts';
