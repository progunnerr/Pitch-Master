import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PitchEngine, type PitchVoice } from '../src/features/audio/PitchEngine.ts';

function setup() {
  const events: string[] = [];
  const releases: (() => void)[] = [];
  const engine = new PitchEngine((midi): PitchVoice => ({
    rewind: () =>
      new Promise((resolve) => {
        events.push(`seek ${midi}`);
        releases.push(resolve);
      }),
    play: () => events.push(`play ${midi}`),
    pause: () => events.push(`pause ${midi}`),
    setVolume: () => {},
    dispose: () => events.push(`dispose ${midi}`),
  }));
  return { engine, events, releases };
}

test('stop during a pending seek never restarts playback', async () => {
  const { engine, events, releases } = setup();
  const pending = engine.play(60);
  await Promise.resolve();
  engine.stop();
  releases.shift()!();
  assert.equal(await pending, false);
  assert.ok(!events.includes('play 60'));
});

test('rapid note selection only plays the newest request', async () => {
  const { engine, events, releases } = setup();
  const first = engine.play(60);
  await Promise.resolve();
  const last = engine.play(67);
  releases.shift()!();
  await first;
  await Promise.resolve();
  releases.shift()!();
  assert.equal(await last, true);
  assert.deepEqual(
    events.filter((event) => event.startsWith('play')),
    ['play 67'],
  );
});

test('disposing a pending note releases players and prevents later play', async () => {
  const { engine, events, releases } = setup();
  const pending = engine.play(69);
  await Promise.resolve();
  engine.dispose();
  releases.shift()!();
  assert.equal(await pending, false);
  assert.ok(events.includes('dispose 69'));
  assert.equal(await engine.play(60), false);
});

test('a failed load does not break subsequent playback', async () => {
  let attempts = 0;
  const engine = new PitchEngine(() => ({
    rewind: async () => {
      if (++attempts === 1) throw new Error('load failed');
    },
    play: () => {},
    pause: () => {},
    setVolume: () => {},
    dispose: () => {},
  }));
  await assert.rejects(engine.play(60));
  assert.equal(await engine.play(60), true);
});
