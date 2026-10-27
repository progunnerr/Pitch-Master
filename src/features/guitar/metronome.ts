export const METRONOME_SOUNDS = ['Wood1', 'Traditional', 'Drums'] as const;
export type MetronomeSound = (typeof METRONOME_SOUNDS)[number];
export type Subdivision = 1 | 2 | 4;
export interface MetronomeSettings {
  bpm: number;
  subdivision: Subdivision;
  sound: MetronomeSound;
  volume: number;
  accents: boolean;
  practiceMode: boolean;
}
export const DEFAULT_METRONOME: MetronomeSettings = {
  bpm: 80,
  subdivision: 1,
  sound: 'Wood1',
  volume: 100,
  accents: true,
  practiceMode: false,
};
export function decodeMetronome(value: unknown): MetronomeSettings {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    bpm:
      typeof v.bpm === 'number' && Number.isFinite(v.bpm) && v.bpm >= 40 && v.bpm <= 160
        ? Math.round(v.bpm)
        : DEFAULT_METRONOME.bpm,
    subdivision: [1, 2, 4].includes(Number(v.subdivision))
      ? (Number(v.subdivision) as Subdivision)
      : 1,
    sound: METRONOME_SOUNDS.includes(v.sound as MetronomeSound)
      ? (v.sound as MetronomeSound)
      : 'Wood1',
    volume:
      typeof v.volume === 'number' && Number.isFinite(v.volume)
        ? Math.max(0, Math.min(100, v.volume))
        : 100,
    accents: v.accents !== false,
    practiceMode: v.practiceMode === true,
  };
}
/** Musical counts for both the metronome and existing rhythm grids. */
export function beatCount(beat: number, beatsPerBar: number) {
  const position = ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
  const fraction = position % 1;
  if (fraction < 0.001) return String(Math.floor(position) + 1);
  if (Math.abs(fraction - 0.5) < 0.001) return '&';
  if (Math.abs(fraction - 0.25) < 0.001) return 'e';
  if (Math.abs(fraction - 0.75) < 0.001) return 'a';
  if (Math.abs(fraction - 1 / 3) < 0.001) return 'trip';
  if (Math.abs(fraction - 2 / 3) < 0.001) return 'let';
  return '·';
}
export function metronomeGain(muted: boolean, volume: number) {
  return muted ? 0 : Math.max(0, Math.min(100, volume)) / 100;
}
export function loopPosition(elapsedMs: number, bpm: number, beatsPerBar: number) {
  return (((elapsedMs * bpm) / 60000) % beatsPerBar) * 0.75;
}
