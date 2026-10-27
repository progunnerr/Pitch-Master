import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as counting from '../src/features/guitar/metronome.ts';

// Exercise the actual hook and asynchronous player hand-offs with a small,
// deterministic hook host. No device, real sleeps or additional dependency.
function host(platform = 'android') {
  let time = 0;
  let cursor = 0;
  let dirty = false;
  const slots: any[] = [];
  const effects: (() => void)[] = [];
  const intervals = new Set<() => void>();
  const events = new Map<string, Set<(state?: string) => void>>();
  const visibility = { hidden: false };
  const players: FakePlayer[] = [];
  let loadNext = true;
  let blockNextSeek = false;
  class FakePlayer {
    source: string;
    volume = 1;
    loop = false;
    shouldCorrectPitch = false;
    isLoaded = loadNext;
    playing = false;
    removed = false;
    currentTime = 0;
    rate = 1;
    plays = 0;
    pauses = 0;
    seeks: number[] = [];
    releaseSeek: (() => void) | null = null;
    listeners = new Set<(status: any) => void>();
    constructor(source: string) {
      this.source = source;
      loadNext = true;
    }
    addListener(_event: string, listener: (status: any) => void) {
      this.listeners.add(listener);
      return { remove: () => this.listeners.delete(listener) };
    }
    status() {
      for (const listener of this.listeners)
        listener({
          isLoaded: this.isLoaded,
          playing: this.playing,
          currentTime: this.currentTime,
          didJustFinish: false,
        });
    }
    seekTo(seconds: number) {
      this.seeks.push(seconds);
      this.currentTime = seconds;
      if (blockNextSeek) {
        blockNextSeek = false;
        return new Promise<void>((resolve) => {
          this.releaseSeek = resolve;
        });
      }
      return Promise.resolve();
    }
    setPlaybackRate(rate: number) {
      this.rate = rate;
    }
    play() {
      assert.equal(this.removed, false, 'removed players cannot restart');
      this.playing = true;
      this.plays++;
      this.status();
    }
    pause() {
      this.playing = false;
      this.pauses++;
      this.status();
    }
    remove() {
      this.removed = true;
      this.playing = false;
      this.listeners.clear();
    }
  }
  const react = {
    useRef(value: any) {
      const i = cursor++;
      return (slots[i] ??= { current: value });
    },
    useState(value: any) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof value === 'function' ? value() : value };
      return [
        slots[i].value,
        (next: any) => {
          const value = typeof next === 'function' ? next(slots[i].value) : next;
          if (!Object.is(value, slots[i].value)) {
            slots[i].value = value;
            dirty = true;
          }
        },
      ];
    },
    useCallback(fn: any, deps: any[]) {
      const i = cursor++;
      if (!slots[i] || deps.some((d, j) => !Object.is(d, slots[i].deps[j])))
        slots[i] = { value: fn, deps };
      return slots[i].value;
    },
    useEffect(fn: () => any, deps: any[]) {
      const i = cursor++;
      if (slots[i] && !deps.some((d, j) => !Object.is(d, slots[i].deps[j]))) return;
      effects.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const module = { exports: {} as any };
  const source = ts.transpileModule(
    readFileSync(new URL('../src/features/guitar/useMetronome.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  runInNewContext(source, {
    exports: module.exports,
    module,
    require(name: string) {
      if (name === 'react') return react;
      if (name === './metronome') return counting;
      if (name === './metronomeAssets')
        return {
          METRONOME_LOOPS: new Proxy({}, { get: (_, key) => key }),
          METRONOME_PREVIEWS: {
            Wood1: 'Wood1-preview',
            Traditional: 'Traditional-preview',
            Drums: 'Drums-preview',
          },
        };
      if (name === 'expo-audio')
        return {
          createAudioPlayer(source: string) {
            const player = new FakePlayer(source);
            players.push(player);
            return player;
          },
          setAudioModeAsync: () => Promise.resolve(),
        };
      if (name === 'react-native')
        return {
          Platform: { OS: platform },
          AppState: {
            addEventListener(event: string, listener: (state?: string) => void) {
              if (!events.has(event)) events.set(event, new Set());
              events.get(event)!.add(listener);
              return { remove: () => events.get(event)!.delete(listener) };
            },
          },
        };
      throw new Error(name);
    },
    performance: { now: () => time },
    document: {
      get hidden() {
        return visibility.hidden;
      },
      addEventListener(event: string, listener: () => void) {
        if (!events.has(event)) events.set(event, new Set());
        events.get(event)!.add(listener);
      },
      removeEventListener(event: string, listener: () => void) {
        events.get(event)?.delete(listener);
      },
    },
    setInterval(fn: () => void) {
      intervals.add(fn);
      return fn;
    },
    clearInterval(fn: () => void) {
      intervals.delete(fn);
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  const interruptions: string[] = [];
  let props = {
    running: false,
    bpm: 80,
    beatsPerBar: 4,
    muted: false,
    volume: 100,
    sound: 'Wood1' as counting.MetronomeSound,
    subdivision: 1 as counting.Subdivision,
    accents: true,
    offsetMs: 0,
    onInterrupt: (reason: string) => {
      interruptions.push(reason);
    },
  };
  let result: ReturnType<typeof module.exports.useMetronome>;
  function render(update = {}) {
    props = { ...props, ...update };
    cursor = 0;
    dirty = false;
    result = module.exports.useMetronome(props);
    for (const effect of effects.splice(0)) effect();
    return result;
  }
  async function flush() {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
      if (dirty) render();
    }
    return result;
  }
  render();
  return {
    players,
    interruptions,
    render,
    flush,
    get result() {
      return result;
    },
    blockSeek() {
      blockNextSeek = true;
    },
    deferLoad() {
      loadNext = false;
    },
    load(player: FakePlayer) {
      player.isLoaded = true;
      player.status();
    },
    event(event: string, state?: string) {
      for (const listener of events.get(event) ?? []) listener(state);
    },
    hide() {
      visibility.hidden = true;
      for (const listener of events.get('visibilitychange') ?? []) listener();
    },
    tick(ms: number, reportStatus = true) {
      time += ms;
      for (const p of players)
        if (p.playing) {
          p.currentTime += (ms / 1000) * p.rate;
          if (p.loop) p.currentTime %= Number(p.source.split('-')[1]) * 0.75;
          if (reportStatus) p.status();
        }
      for (const fn of intervals) fn();
      if (dirty) render();
    },
    dispose() {
      for (const slot of slots) slot?.cleanup?.();
    },
  };
}

test('mute/unmute and volume adjust the running loop without seeking, pausing, or resetting visual beats', async () => {
  const h = host();
  await h.flush();
  h.render({ running: true });
  await h.flush();
  const p = h.players[0]!;
  h.tick(1000);
  const pauses = p.pauses,
    seeks = p.seeks.length;
  h.render({ muted: true, offsetMs: 1000 });
  await h.flush();
  assert.equal(p.volume, 0);
  assert.equal(p.playing, true);
  h.tick(750);
  assert.ok(h.result.totalBeat > 1);
  h.render({ muted: false, volume: 40 });
  await h.flush();
  assert.equal(p.volume, 0.4);
  assert.equal(p.pauses, pauses);
  assert.equal(p.seeks.length, seeks);
  h.dispose();
});

test('bar counts advance across native loop wraps without relying on practice timer updates', async () => {
  for (const beatsPerBar of [2, 3, 4, 6]) {
    for (const bpm of [40, 80, 160]) {
      const h = host('ios');
      await h.flush();
      h.render({ running: true, bpm, beatsPerBar });
      await h.flush();
      let previous = 0;
      for (let i = 1; i <= 240; i++) {
        h.tick(50);
        const expected = (i * 50 * bpm) / 60000;
        assert.ok(h.result.totalBeat >= previous, 'total beats must never decrease');
        assert.ok(Math.abs(h.result.totalBeat - expected) < 0.000001);
        assert.equal(
          Math.floor(h.result.totalBeat / beatsPerBar + 0.000001),
          Math.floor(expected / beatsPerBar + 0.000001),
        );
        previous = h.result.totalBeat;
      }
      h.dispose();
    }
  }
});

test('a delayed native sample at a bar boundary cannot rewind the bar or beat highlight', async () => {
  const h = host('ios');
  await h.flush();
  h.render({ running: true, offsetMs: 2950 });
  await h.flush();
  const p = h.players[0]!;
  h.tick(100, false);
  const before = h.result.totalBeat;
  assert.ok(before > 4);
  // A sample from just before the wrap arrives after the display crossed it.
  p.currentTime = 2.99;
  p.status();
  h.tick(0, false);
  assert.equal(Math.floor(h.result.totalBeat / 4), 1);
  assert.ok(h.result.totalBeat >= before);
  assert.ok(h.result.beat < 1);
  // The following native update catches up without adding another bar.
  p.currentTime = 0.1;
  p.status();
  h.tick(0, false);
  assert.ok(h.result.totalBeat >= before);
  assert.ok(h.result.totalBeat < 4.2);
  h.dispose();
});

test('missed status updates and a delayed display tick preserve every elapsed bar', async () => {
  const h = host('ios');
  await h.flush();
  h.render({ running: true });
  await h.flush();
  h.tick(9350, false);
  assert.ok(Math.abs(h.result.totalBeat - 9350 / 750) < 0.000001);
  h.players[0]!.status();
  h.tick(50);
  assert.ok(Math.abs(h.result.totalBeat - 9400 / 750) < 0.000001);
  h.dispose();
});

test('sound changes after multiple bars preserve progress despite a stale practice offset', async () => {
  const h = host('ios');
  await h.flush();
  h.render({ running: true });
  await h.flush();
  h.tick(9400);
  const before = h.result.totalBeat;
  h.render({ sound: 'Traditional', muted: true, subdivision: 4, offsetMs: 9300 });
  await h.flush();
  h.tick(50);
  assert.ok(h.result.totalBeat > before);
  assert.ok(Math.abs(h.result.totalBeat - 9450 / 750) < 0.000001);
  h.render({ muted: false, offsetMs: 9600 });
  h.tick(50);
  assert.ok(Math.abs(h.result.totalBeat - 9500 / 750) < 0.000001);
  h.dispose();
});

test('resume and a new transport explicitly reseed the counter, including a pending seek', async () => {
  const h = host('ios');
  await h.flush();
  h.render({ running: true, offsetMs: 9350 });
  await h.flush();
  h.tick(100);
  h.render({ running: false, offsetMs: 9450 });
  await h.flush();
  h.tick(5000);
  h.blockSeek();
  h.render({ running: true });
  await h.flush();
  h.render({ offsetMs: 9550 });
  h.players[0]!.releaseSeek!();
  await h.flush();
  // The visual clock must start at the offset actually sought, even if practice
  // elapsed time advanced while the asynchronous seek was pending.
  assert.ok(Math.abs(h.result.totalBeat - 9450 / 750) < 0.000001);
  h.tick(50);
  assert.ok(Math.abs(h.result.totalBeat - 9500 / 750) < 0.000001);
  h.render({ transportKey: 'next-exercise', offsetMs: 0 });
  await h.flush();
  assert.equal(h.result.totalBeat, 0);
  assert.equal(h.result.beat, 0);
  h.tick(750);
  assert.equal(h.result.totalBeat, 1);
  h.dispose();
});

test('sound switching loads beside the old loop and takes over at its current beat and BPM', async () => {
  const h = host();
  await h.flush();
  h.render({ running: true, bpm: 120 });
  await h.flush();
  h.tick(1000);
  const old = h.players[0]!;
  const pauses = old.pauses;
  h.deferLoad();
  h.render({ sound: 'Drums', offsetMs: 1000 });
  await h.flush();
  const next = h.players[1]!;
  assert.equal(old.playing, true);
  assert.equal(old.pauses, pauses);
  h.tick(250);
  h.load(next);
  await h.flush();
  assert.equal(old.removed, true);
  assert.equal(next.playing, true);
  assert.equal(next.rate, 1.5);
  assert.equal(next.seeks.at(-1), 1.875);
  assert.equal(h.interruptions.length, 0);
  h.dispose();
});

test('Stop cancels a pending Start seek and prevents playback after it resolves', async () => {
  const h = host();
  await h.flush();
  h.blockSeek();
  h.render({ running: true });
  await h.flush();
  const p = h.players[0]!;
  h.result.stop();
  h.render({ running: false });
  p.releaseSeek!();
  await h.flush();
  assert.equal(p.plays, 0);
  assert.equal(p.playing, false);
  h.dispose();
});

test('changing a preset during a pending Start never plays the removed source or resets the transport', async () => {
  const h = host();
  await h.flush();
  h.blockSeek();
  h.render({ running: true });
  await h.flush();
  const old = h.players[0]!;
  h.render({ sound: 'Traditional' });
  await h.flush();
  old.releaseSeek!();
  await h.flush();
  assert.equal(old.plays, 0);
  assert.equal(h.players[1]!.playing, true);
  assert.equal(h.interruptions.length, 0);
  h.dispose();
});

test('Stop and background interruptions cancel pending preset hand-offs and silence previews', async () => {
  for (const event of ['stop', 'background', 'blur']) {
    const h = host();
    await h.flush();
    h.render({ running: true });
    await h.flush();
    h.result.previewSound('Traditional');
    h.blockSeek();
    h.render({ sound: 'Drums' });
    await h.flush();
    const next = h.players.at(-1)!;
    if (event === 'stop') h.result.stop();
    else if (event === 'background') h.event('change', 'background');
    else h.event('blur');
    h.render({ running: false });
    next.releaseSeek!();
    await h.flush();
    assert.ok(h.players.every((p) => !p.playing));
    assert.equal(h.interruptions.length, event === 'stop' ? 0 : 1);
    h.dispose();
  }
});

test('all previews obey mute and volume without changing the running source', async () => {
  const h = host();
  await h.flush();
  h.render({ running: true, muted: true });
  await h.flush();
  const original = h.players[0]!;
  for (const sound of counting.METRONOME_SOUNDS) {
    h.result.previewSound(sound);
    assert.equal(h.players.at(-1)!.volume, 0);
    assert.equal(original.playing, true);
  }
  h.render({ muted: false, volume: 60 });
  await h.flush();
  assert.equal(h.players.at(-1)!.volume, 0.6);
  h.dispose();
  assert.ok(h.players.every((p) => p.removed));
});

test('navigation cleanup cancels an unloaded sound and releases every player', async () => {
  const h = host();
  await h.flush();
  h.render({ running: true });
  await h.flush();
  h.deferLoad();
  h.render({ sound: 'Drums' });
  await h.flush();
  h.dispose();
  h.load(h.players.at(-1)!);
  await h.flush();
  assert.ok(h.players.every((p) => p.removed && !p.playing));
});

test('hidden web tabs pause playback and returning to the foreground does not auto-start', async () => {
  const h = host('web');
  await h.flush();
  h.render({ running: true });
  await h.flush();
  h.hide();
  h.render({ running: false });
  await h.flush();
  h.event('change', 'active');
  await h.flush();
  assert.equal(h.interruptions.length, 1);
  assert.ok(h.players.every((p) => !p.playing));
  h.dispose();
});

test('audible subdivisions and accents can change while muted without resetting playback', async () => {
  const h = host();
  await h.flush();
  h.render({ running: true, muted: true });
  await h.flush();
  h.tick(1000);
  h.render({ subdivision: 4, accents: false, offsetMs: 1000 });
  await h.flush();
  const p = h.players.at(-1)!;
  assert.equal(p.volume, 0);
  assert.equal(p.playing, true);
  assert.equal(p.source, 'Wood1-4-4-plain');
  assert.equal(p.seeks.at(-1), 1);
  h.render({ muted: false });
  await h.flush();
  assert.equal(p.volume, 1);
  assert.equal(p.playing, true);
  assert.equal(h.interruptions.length, 0);
  h.dispose();
});

test('preview uses the selected tempo and omits the bell when accents are disabled', async () => {
  const h = host();
  await h.flush();
  h.render({ bpm: 120, accents: false, running: true });
  await h.flush();
  const loop = h.players.at(-1)!;
  h.result.previewSound('Traditional');
  const preview = h.players.at(-1)!;
  assert.equal(preview.source, 'Traditional-4-1-plain');
  assert.equal(preview.rate, 1.5);
  assert.equal(loop.rate, 1.5);
  assert.equal(loop.playing, true);
  h.dispose();
});
