import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// One native loop per meter at 80 BPM. Playback rate covers 40–160 BPM (0.5–2x).
// Rendering beats into PCM avoids accumulated JavaScript timer/seek jitter.
const directory = fileURLToPath(new URL('../assets/audio/metronome/', import.meta.url));
mkdirSync(directory, { recursive: true });
for (const beats of [2, 3, 4, 6]) {
  const rate = 16000;
  const frames = beats * rate * 0.75;
  const wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(frames * 2, 40);
  for (let beat = 0; beat < beats; beat++) {
    // A sustained, bell-like downbeat is easier to distinguish than pitch alone,
    // including at the slowest and fastest playback rates.
    const downbeat = beat === 0;
    const duration = downbeat ? 0.1 : 0.025;
    for (let i = 0; i < rate * duration; i++) {
      const t = i / rate;
      const tone = downbeat
        ? 0.75 * Math.sin(2 * Math.PI * 1760 * t) + 0.25 * Math.sin(2 * Math.PI * 2640 * t)
        : Math.sin(2 * Math.PI * 880 * t);
      const sample =
        tone *
        Math.exp(-t * (downbeat ? 45 : 180)) *
        Math.min(1, i / 12) *
        Math.min(1, (duration - t) / 0.005) *
        (downbeat ? 0.8 : 0.55);
      wav.writeInt16LE(Math.round(sample * 32767), 44 + (beat * rate * 0.75 + i) * 2);
    }
  }
  writeFileSync(`${directory}/${beats}.wav`, wav);
}

// Original, deterministically synthesized percussion. No third-party recordings.
// 44.1 kHz / 16-bit mono PCM. Match regular clicks across presets, with
// deliberately stronger downbeats and distinct acoustic-style resonances.
const sampleRate = 44100;
const presets = ['Wood1', 'Traditional', 'Drums'];
const output = `${directory}/presets`;
mkdirSync(output, { recursive: true });
function click(sound, variant) {
  const accent = variant === 'accent';
  const sub = variant === 'sub';
  const duration = sub ? 0.045 : sound === 'Traditional' && accent ? 0.6 : accent ? 0.18 : 0.09;
  const frames = Math.round(duration * sampleRate);
  const pcm = new Float64Array(frames);
  let seed = 1234567;
  let lowNoise = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    lowNoise += (noise - lowNoise) * 0.25;
    const highNoise = noise - lowNoise;
    const mode = (hz, decay) => Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * decay);
    let tone;
    if (sound === 'Wood1') {
      // A hollow block: separate, inharmonic body modes and a short stick attack.
      // The high block downbeat has a fuller, longer body than the low block pulse.
      const fundamental = accent ? 1120 : sub ? 620 : 800;
      const damping = accent ? 35 : 65;
      tone =
        mode(fundamental, damping) +
        0.6 * mode(fundamental * 1.47, damping * 1.4) +
        0.25 * mode(fundamental * 2.63, damping * 2.2) +
        highNoise * Math.exp(-t * 750) * 0.22;
    } else if (sound === 'Traditional') {
      const tick =
        0.75 * highNoise * Math.exp(-t * 650) + 0.45 * mode(2350, 230) + 0.3 * mode(720, 160);
      // Beat 1 is an actual ringing bell timbre over the mechanical tick,
      // rather than the same click shifted up in pitch. Disabling accents
      // removes the bell completely. Partial decay rates preserve the metal ring.
      tone = accent
        ? 0.8 * mode(1480, 6) +
          0.5 * mode(1480 * 2.01, 10) +
          0.4 * mode(1480 * 2.756, 8) +
          0.18 * mode(1480 * 4.07, 16) +
          0.1 * mode(1480 * 5.404, 22) +
          tick * 0.3
        : tick;
    } else if (sub) {
      // A closed-hat style tap makes subdivision clicks distinct from the rim.
      tone = highNoise * Math.exp(-t * 210);
    } else if (accent) {
      // A snare strike: falling drum-head resonance plus short wire buzz.
      const head = Math.sin(2 * Math.PI * (155 * t + (45 * (1 - Math.exp(-t * 70))) / 70));
      tone =
        head * Math.exp(-t * 32) * 0.75 +
        highNoise * Math.exp(-t * 30) * 0.65 +
        0.15 * mode(340, 55) +
        0.16 * mode(1800, 160);
    } else {
      // Cross-stick/rim pulse: sharp stick contact and a lower drum-shell body.
      tone =
        0.8 * mode(1850, 140) +
        0.45 * mode(3250, 210) +
        0.6 * mode(420, 90) +
        highNoise * Math.exp(-t * 850) * 0.5;
    }
    const fade = sound === 'Traditional' && accent ? 0.08 : 0.008;
    pcm[i] = tone * Math.min(1, i / 10) * Math.min(1, (duration - t) / fade);
  }
  // Lower transient crest factors before energy matching, so narrow mechanical
  // ticks remain as audible as resonant wood/drum clicks without clipping.
  const rawPeak = Math.max(...pcm.map(Math.abs));
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.tanh((pcm[i] / rawPeak) * 3);
  const energy = Math.sqrt(pcm.reduce((sum, x) => sum + x * x, 0) / (sampleRate * 0.055));
  const peak = Math.max(...pcm.map(Math.abs));
  const attackEnergy = Math.sqrt(
    pcm.subarray(0, Math.round(sampleRate * 0.055)).reduce((sum, x) => sum + x * x, 0) /
      (sampleRate * 0.055),
  );
  const target = sub ? 0.065 : accent ? 0.34 : 0.17;
  const gain = Math.min(target / (accent ? attackEnergy : energy), 0.96 / peak);
  return pcm.map((x) => x * gain);
}
function writeWav(path, pcm) {
  const wav = Buffer.alloc(44 + pcm.length * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcm.length * 2, 40);
  pcm.forEach((x, i) => wav.writeInt16LE(Math.round(x * 32767), 44 + i * 2));
  writeFileSync(path, wav);
}
const sources = [];
const previews = [];
for (const sound of presets) {
  const samples = Object.fromEntries(['primary', 'accent', 'sub'].map((v) => [v, click(sound, v)]));
  previews.push(
    `  ${sound}: require('../../../assets/audio/metronome/presets/${sound}-preview.wav'),`,
  );
  for (const beats of [2, 3, 4, 6])
    for (const subdivision of [1, 2, 4])
      for (const accents of [false, true]) {
        const name = `${sound}-${beats}-${subdivision}-${accents ? 'accent' : 'plain'}`;
        const pcm = new Float64Array(beats * sampleRate * 0.75);
        for (let step = 0; step < beats * subdivision; step++) {
          const sample =
            step % subdivision !== 0
              ? samples.sub
              : step === 0 && accents
                ? samples.accent
                : samples.primary;
          const onset = Math.round((step * sampleRate * 0.75) / subdivision);
          sample.forEach((x, i) => {
            pcm[onset + i] += x;
          });
        }
        // Bell tails can overlap softer subdivision taps. Preserve the tail and
        // its timing, applying only shared peak headroom to the completed loop.
        let peak = 0;
        for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
        if (peak > 0.97) for (let i = 0; i < pcm.length; i++) pcm[i] *= 0.97 / peak;
        writeWav(`${output}/${name}.wav`, pcm);
        if (beats === 4 && subdivision === 1 && accents)
          writeWav(`${output}/${sound}-preview.wav`, pcm);
        sources.push(
          `  '${name}': require('../../../assets/audio/metronome/presets/${name}.wav'),`,
        );
      }
}
writeFileSync(
  fileURLToPath(new URL('../src/features/guitar/metronomeAssets.ts', import.meta.url)),
  `// Generated by scripts/generate-metronome.mjs. Static requires are needed by Metro.\nexport const METRONOME_LOOPS: Record<string, number> = {\n${sources.join('\n')}\n};\nexport const METRONOME_PREVIEWS = {\n${previews.join('\n')}\n};\n`,
);
