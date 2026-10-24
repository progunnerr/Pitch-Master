import type { Accidentals, Direction, Notation, ScaleId } from '../../domain/musicTheory/index.ts';
import { SCALES } from '../../domain/musicTheory/scales.ts';

export interface Preferences {
  tonic: number;
  notation: Notation;
  accidentals: Accidentals;
  solfegeConvention: Accidentals;
  octave: number;
  scale: ScaleId;
  direction: Direction;
  tempo: number;
  volume: number;
  haptics: boolean;
  soundOnRotate: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  tonic: 0,
  notation: 'solfege',
  accidentals: 'sharps',
  solfegeConvention: 'sharps',
  octave: 4,
  scale: 'chromatic',
  direction: 'ascending',
  tempo: 100,
  volume: 0.65,
  haptics: true,
  soundOnRotate: false,
};

export const STORAGE_KEY = '@pitch-master/preferences/v1';

// Validate fields independently so one old or corrupt setting does not discard everything.
export function decodePreferences(raw: string | null): Preferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('version' in parsed) ||
    parsed.version !== 1 ||
    !('preferences' in parsed)
  )
    return { ...DEFAULT_PREFERENCES };
  const values = parsed.preferences;
  if (!values || typeof values !== 'object') return { ...DEFAULT_PREFERENCES };
  const v = values as Record<string, unknown>;
  const output = { ...DEFAULT_PREFERENCES };
  if (typeof v.tonic === 'number' && Number.isInteger(v.tonic) && v.tonic >= 0 && v.tonic < 12)
    output.tonic = v.tonic;
  if (v.notation === 'solfege' || v.notation === 'sargam' || v.notation === 'degrees')
    output.notation = v.notation;
  if (v.accidentals === 'sharps' || v.accidentals === 'flats') output.accidentals = v.accidentals;
  if (v.solfegeConvention === 'sharps' || v.solfegeConvention === 'flats')
    output.solfegeConvention = v.solfegeConvention;
  if (typeof v.octave === 'number' && Number.isInteger(v.octave) && v.octave >= 3 && v.octave <= 5)
    output.octave = v.octave;
  if (typeof v.scale === 'string' && Object.hasOwn(SCALES, v.scale))
    output.scale = v.scale as ScaleId;
  if (v.direction === 'ascending' || v.direction === 'descending') output.direction = v.direction;
  if (typeof v.tempo === 'number' && Number.isInteger(v.tempo) && v.tempo >= 40 && v.tempo <= 200)
    output.tempo = v.tempo;
  if (typeof v.volume === 'number' && Number.isFinite(v.volume) && v.volume >= 0 && v.volume <= 1)
    output.volume = v.volume;
  if (typeof v.haptics === 'boolean') output.haptics = v.haptics;
  if (typeof v.soundOnRotate === 'boolean') output.soundOnRotate = v.soundOnRotate;
  return output;
}

export function encodePreferences(preferences: Preferences): string {
  return JSON.stringify({ version: 1, preferences });
}
