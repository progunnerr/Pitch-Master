import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  beatCount,
  DEFAULT_METRONOME,
  METRONOME_SOUNDS,
  loopPosition,
  metronomeGain,
} from '../src/features/guitar/metronome.ts';
import {
  advanceFreeTransport,
  createFreeTransport,
  createPracticeClock,
  creditDays,
  localDay,
  updateFreeTransport,
} from '../src/features/guitar/practiceTime.ts';
import {
  activeMs,
  advanceSession,
  createSession,
  pauseSession,
  resumeSession,
  setSessionPractice,
  weeklySummary,
} from '../src/features/guitar/session.ts';
import { defaultRoutine } from '../src/features/guitar/model.ts';
import {
  decodeStudio,
  emptyStudio,
  saveFreePractice,
  saveSession,
  studioDayMs,
} from '../src/features/guitar/storage.ts';

const now = new Date(2026, 9, 25, 12).getTime();

test('standard counts replace fractional labels in eighths, sixteenths and multiple bars', () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, i) => beatCount(i / 2, 4)),
    ['1', '&', '2', '&', '3', '&', '4', '&'],
  );
  assert.deepEqual(
    Array.from({ length: 8 }, (_, i) => beatCount(i / 4, 4)),
    ['1', 'e', '&', 'a', '2', 'e', '&', 'a'],
  );
  assert.equal(beatCount(4.5, 4), '&');
  assert.equal(beatCount(4, 4), '1');
  assert.equal(beatCount(1 / 3, 4), 'trip');
});

test('starting the metronome does not opt into practice; every On/Off transition credits only its elapsed slice', () => {
  let s = createFreeTransport(now, false);
  s = updateFreeTransport(s, now, { running: true });
  s = advanceFreeTransport(s, now + 5000);
  assert.equal(s.practice.activeMs, 0);
  s = updateFreeTransport(s, now + 5500, { practiceMode: true });
  s = updateFreeTransport(s, now + 8750, { running: false });
  assert.equal(s.practice.activeMs, 3250);
  s = advanceFreeTransport(s, now + 100000);
  assert.equal(s.practice.activeMs, 3250);
  s = updateFreeTransport(s, now + 100000, { running: true });
  s = updateFreeTransport(s, now + 101500, { practiceMode: false });
  assert.equal(s.practice.activeMs, 4750);
  s = advanceFreeTransport(s, now + 150000);
  assert.equal(s.practice.activeMs, 4750);
  assert.equal(s.running, true, 'Practice Off keeps the metronome running');
  s = updateFreeTransport(s, now + 150000, { practiceMode: true });
  assert.equal(advanceFreeTransport(s, now + 151000).practice.activeMs, 5750);
});

test('mute and volume change output only: silent practice continues at the same tempo', () => {
  let s = updateFreeTransport(createFreeTransport(now, true), now, { running: true });
  for (const muted of [false, true, false, true]) {
    assert.equal(metronomeGain(muted, 80), muted ? 0 : 0.8);
    s = advanceFreeTransport(s, s.anchorMs! + 1500);
  }
  assert.equal(s.practice.activeMs, 6000);
  assert.equal(metronomeGain(false, 0), 0);
  assert.equal(metronomeGain(false, 100), 1);
  assert.equal(loopPosition(21000, 80, 4), 0, 'sound-independent position never changes tempo');
});

test('background and navigation interruptions stop immediately and never credit time away', () => {
  let s = updateFreeTransport(createFreeTransport(now, true), now, { running: true });
  s = updateFreeTransport(s, now + 1234, { running: false });
  assert.equal(advanceFreeTransport(s, now + 3600000), s);
  s = updateFreeTransport(s, now + 3600000, { running: true });
  s = advanceFreeTransport(s, now + 3600766);
  assert.equal(s.practice.activeMs, 2000);
  assert.equal(advanceFreeTransport(s, now), s);
});

test('monotonic elapsed time survives a wall-clock change and infrequent updates', () => {
  let monotonic = 250;
  const clock = createPracticeClock(now, () => monotonic);
  monotonic += 120000;
  assert.equal(clock(), now + 120000);
  const s = updateFreeTransport(createFreeTransport(now, true), now, { running: true });
  assert.equal(advanceFreeTransport(s, clock()).practice.activeMs, 120000);
});

test('local daily totals split at midnight rather than assigning the session to its start day', () => {
  const midnight = new Date(2026, 9, 26).getTime();
  const days = creditDays({}, midnight - 2500, midnight + 1500);
  assert.deepEqual(days, { [localDay(midnight - 1)]: 2500, [localDay(midnight)]: 1500 });
  const s = advanceFreeTransport(
    updateFreeTransport(createFreeTransport(midnight - 2500, true), midnight - 2500, {
      running: true,
    }),
    midnight + 1500,
  );
  const data = saveFreePractice(emptyStudio(), s.practice);
  assert.equal(studioDayMs(data, localDay(midnight)), 1500);
  assert.equal(studioDayMs(decodeStudio(JSON.stringify(data)), localDay(midnight - 1)), 2500);
});

test('free checkpoints and routine checkpoints each upsert once and combine without double-counting', () => {
  const free = advanceFreeTransport(
    updateFreeTransport(createFreeTransport(now, true), now, { running: true }),
    now + 3000,
  ).practice;
  const session = advanceSession(createSession(defaultRoutine(), now, true, false), now + 7000);
  let data = saveSession(saveFreePractice(emptyStudio(), free), session);
  data = saveSession(saveFreePractice(data, free), session);
  assert.equal(data.sessions.length, 1);
  assert.equal(data.freePractice.length, 1);
  assert.equal(studioDayMs(data, localDay(now)), 10000);
  assert.equal(weeklySummary(data.sessions, new Date(now), data.freePractice).weekMs, 10000);
  const restored = decodeStudio(JSON.stringify(data));
  assert.equal(restored.sessions[0]!.anchorMs, null);
  assert.equal(studioDayMs(restored, localDay(now)), 10000);
});

test('routine Practice Mode Off stops credit without stopping the metronome or routine progression', () => {
  let s = createSession(defaultRoutine(), now, true, false);
  s = setSessionPractice(s, now + 2500, false);
  s = advanceSession(s, now + 7000);
  assert.equal(activeMs(s), 2500);
  assert.equal(s.phaseElapsedMs, 7000);
  assert.notEqual(s.anchorMs, null);
  s = setSessionPractice(s, now + 8000, true);
  s = pauseSession(s, now + 9500);
  assert.equal(activeMs(s), 4000);
  s = resumeSession(s, now + 60000);
  assert.equal(activeMs(advanceSession(s, now + 61000)), 5000);
});

test('metronome settings, mute and practice history persist; legacy data gets quarter clicks and Practice Off', () => {
  const data = emptyStudio();
  data.metronome = {
    bpm: 137,
    subdivision: 4,
    sound: 'Drums',
    volume: 60,
    accents: false,
    practiceMode: true,
  };
  data.settings.metronome = false;
  const restored = decodeStudio(JSON.stringify(data));
  assert.deepEqual(restored.metronome, data.metronome);
  assert.equal(restored.settings.metronome, false);
  const legacy = JSON.parse(JSON.stringify(data));
  delete legacy.metronome;
  delete legacy.freePractice;
  assert.deepEqual(decodeStudio(JSON.stringify(legacy)).metronome, DEFAULT_METRONOME);
  legacy.metronome = { bpm: null, subdivision: 3, volume: 'loud', sound: 'proprietary' };
  assert.deepEqual(decodeStudio(JSON.stringify(legacy)).metronome, DEFAULT_METRONOME);
});

test('legacy routine totals are retained and corrupted daily maps cannot inflate saved practice', () => {
  const session = advanceSession(createSession(defaultRoutine(), now, true, false), now + 5000);
  const data = JSON.parse(JSON.stringify(saveSession(emptyStudio(), session)));
  delete data.sessions[0].dailyMs;
  delete data.sessions[0].practiceEnabled;
  let restored = decodeStudio(JSON.stringify(data));
  assert.equal(studioDayMs(restored, localDay(now)), 5000);
  assert.equal(restored.sessions[0]!.practiceEnabled, true);
  data.sessions[0].dailyMs = { [localDay(now)]: 99999999 };
  restored = decodeStudio(JSON.stringify(data));
  assert.equal(studioDayMs(restored, localDay(now)), 5000);
});

function wav(name: string) {
  const b = readFileSync(new URL(`../assets/audio/metronome/presets/${name}.wav`, import.meta.url));
  const rate = b.readUInt32LE(24);
  assert.equal(rate, 44100);
  assert.equal(b.readUInt16LE(34), 16);
  return {
    b,
    rate,
    frames: b.readUInt32LE(40) / 2,
    sample: (i: number) => b.readInt16LE(44 + i * 2) / 32767,
  };
}
function energy(b: ReturnType<typeof wav>, start: number, frames: number) {
  let sum = 0;
  for (let i = 0; i < frames; i++) sum += b.sample(start + i) ** 2;
  return Math.sqrt(sum / frames);
}

test('exactly three original presets have consistent loudness, distinct clicks and offline previews', () => {
  assert.deepEqual(METRONOME_SOUNDS, ['Wood1', 'Traditional', 'Drums']);
  const energies = METRONOME_SOUNDS.map((name) => {
    const sound = wav(`${name}-4-1-plain`);
    const preview = wav(`${name}-preview`);
    assert.ok(preview.frames > 1000);
    return energy(sound, 0, Math.round(sound.rate * 0.055));
  });
  assert.ok(
    20 * Math.log10(Math.max(...energies) / Math.min(...energies)) < 1.5,
    'preset RMS energy matches within 1.5 dB',
  );
  assert.notDeepEqual(wav('Wood1-preview').b, wav('Traditional-preview').b);
  assert.notDeepEqual(wav('Traditional-preview').b, wav('Drums-preview').b);
});

test('all native loops have exact timing, optional accents, distinguishable subdivisions and no clipping', () => {
  for (const sound of METRONOME_SOUNDS)
    for (const beats of [2, 3, 4, 6])
      for (const sub of [1, 2, 4])
        for (const accent of [false, true]) {
          const name = `${sound}-${beats}-${sub}-${accent ? 'accent' : 'plain'}`;
          const audio = wav(name);
          assert.equal(audio.frames / audio.rate, beats * 0.75);
          for (const bpm of [40, 80, 160])
            assert.equal(audio.frames / audio.rate / (bpm / 80), (beats * 60) / bpm);
          for (let step = 0; step < beats * sub; step++) {
            const onset = Math.round((step * audio.rate * 0.75) / sub);
            const level = energy(audio, onset, 2000);
            assert.ok(level > 0.05, `${name} click ${step} is audible`);
            if (step % sub) {
              // A ringing downbeat deliberately sustains underneath later taps;
              // compare the tap's level without that separate bell layer.
              const clicks =
                sound === 'Traditional' && accent ? wav(`${sound}-${beats}-${sub}-plain`) : audio;
              assert.ok(
                energy(clicks, onset, 2000) <
                  energy(clicks, Math.round(audio.rate * 0.75), 2000) * 0.8,
                'subdivision is softer',
              );
            }
          }
          assert.equal(audio.sample(audio.frames - 1), 0);
          for (let i = 0; i < audio.frames; i++)
            assert.ok(Math.abs(audio.sample(i)) < 0.98, 'no clipping');
          const first = audio.b.subarray(44, 4044);
          const next = audio.b.subarray(44 + audio.rate * 0.75 * 2, 4044 + audio.rate * 0.75 * 2);
          if (accent) assert.notDeepEqual(first, next);
          else assert.deepEqual(first, next, 'disabling accents makes beat 1 a regular beat');
        }
});

test('downbeats are substantially stronger than the regular pulse in every preset', () => {
  for (const sound of METRONOME_SOUNDS) {
    const audio = wav(`${sound}-4-1-accent`);
    const frames = Math.round(audio.rate * 0.055);
    const accent = energy(audio, 0, frames);
    const regular = energy(audio, Math.round(audio.rate * 0.75), frames);
    assert.ok(
      20 * Math.log10(accent / regular) >= 5.5,
      `${sound} downbeat should be about 6 dB stronger`,
    );
  }
});

test('Traditional has an audible ringing bell on beat 1 that disappears when accents are off', () => {
  const accent = wav('Traditional-4-1-accent');
  const plain = wav('Traditional-4-1-plain');
  const from = Math.round(accent.rate * 0.3);
  const frames = Math.round(accent.rate * 0.1);
  assert.ok(energy(accent, from, frames) > 0.04, 'bell sustains beyond the tick');
  assert.equal(energy(plain, from, frames), 0, 'no bell with accents off');
});

test('each preview plays a complete bar so the accent can be compared with regular beats', () => {
  for (const sound of METRONOME_SOUNDS)
    assert.deepEqual(wav(`${sound}-preview`).b, wav(`${sound}-4-1-accent`).b);
});
