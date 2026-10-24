import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frequency } from '../src/domain/musicTheory/index.ts';
import { createDroneLoop } from '../src/features/audio/droneWave.ts';
import { PitchEngine, type PitchVoice } from '../src/features/audio/PitchEngine.ts';

test('a one-voice drone cache releases the old player when retuning', async () => {
  const released: number[] = [];
  const drone = new PitchEngine(
    (midi) => ({
      rewind: async () => {},
      play: () => {},
      pause: () => {},
      setVolume: () => {},
      dispose: () => {
        released.push(midi);
      },
    }),
    1,
  );
  await drone.play(60);
  await drone.play(62);
  assert.deepEqual(released, [60]);
  drone.dispose();
  assert.deepEqual(released, [60, 62]);
});

test('all 36 drone loops preserve tuning, phase, steady amplitude, and mixing headroom', () => {
  for (let octave = 3; octave <= 5; octave++)
    for (let pitch = 0; pitch < 12; pitch++) {
      const expected = frequency(pitch, octave);
      const loop = createDroneLoop(expected);
      assert.ok(Math.abs(1200 * Math.log2(loop.frequency / expected)) < 0.01);
      assert.equal(loop.samples[0], 0);
      assert.ok(Math.abs(loop.samples[1]! + loop.samples.at(-1)!) < 0.000001);
      let peak = 0;
      let startPower = 0;
      let endPower = 0;
      for (let i = 0; i < loop.samples.length; i++) {
        peak = Math.max(peak, Math.abs(loop.samples[i]!));
        if (i < loop.sampleRate) startPower += loop.samples[i]! ** 2;
        if (i >= loop.samples.length - loop.sampleRate) endPower += loop.samples[i]! ** 2;
      }
      assert.ok(peak < 0.25);
      assert.ok(Math.abs(startPower / endPower - 1) < 0.01);
    }
  assert.throws(() => createDroneLoop(0), RangeError);
});

test('melody changes and sequence stops leave an independent drone sounding', async () => {
  const sounding = new Map<string, number>();
  const factory =
    (name: string) =>
    (midi: number): PitchVoice => ({
      rewind: async () => {},
      play: () => {
        sounding.set(name, midi);
      },
      pause: () => {
        if (sounding.get(name) === midi) sounding.delete(name);
      },
      setVolume: () => {},
      dispose: () => {},
    });
  const drone = new PitchEngine(factory('drone'));
  const melody = new PitchEngine(factory('melody'));
  await drone.play(60);
  await melody.play(64);
  await melody.play(67);
  assert.deepEqual(
    [...sounding.entries()],
    [
      ['drone', 60],
      ['melody', 67],
    ],
  );
  melody.stop();
  assert.equal(sounding.get('drone'), 60);
  await drone.play(62);
  assert.deepEqual([...sounding.entries()], [['drone', 62]]);
  drone.stop();
  melody.stop();
  assert.equal(sounding.size, 0);
  drone.dispose();
  melody.dispose();
});

test('master volume changes reach cached and newly created drone voices', async () => {
  const volumes = new Map<number, number>();
  const drone = new PitchEngine((midi) => ({
    rewind: async () => {},
    play: () => {},
    pause: () => {},
    dispose: () => {},
    setVolume: (value) => {
      volumes.set(midi, value);
    },
  }));
  await drone.play(60);
  drone.setVolume(0);
  await drone.play(62);
  assert.equal(volumes.get(60), 0);
  assert.equal(volumes.get(62), 0);
  drone.dispose();
});
