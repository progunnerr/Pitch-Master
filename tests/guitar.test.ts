import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  chordAt,
  copy,
  DEFAULT_CHORDS,
  defaultRoutine,
  newBlock,
  patternError,
  patternTimeline,
  PRESET_PATTERNS,
  routineError,
  routineSeconds,
  type PracticeRoutine,
} from '../src/features/guitar/model.ts';
import {
  activeMs,
  advanceSession,
  confirmSession,
  createSession,
  endSession,
  pauseSession,
  resumeSession,
  skipBlock,
  weeklySummary,
} from '../src/features/guitar/session.ts';
import { decodeStudio, emptyStudio, saveSession } from '../src/features/guitar/storage.ts';

const now = new Date(2026, 9, 24, 12).getTime();
function routine(durations = [10, 20], breaks = [0, 0]): PracticeRoutine {
  return {
    id: 'test',
    name: 'Test routine',
    blocks: durations.map((durationSeconds, i) => ({
      ...newBlock(),
      id: `block-${i}`,
      durationSeconds,
      breakSeconds: breaks[i] ?? 0,
      bpm: 60,
    })),
  };
}

test('default routine is exactly two 15-minute exercises, with the requested actions', () => {
  const daily = defaultRoutine();
  assert.equal(daily.name, 'Daily Strumming Practice');
  assert.equal(routineSeconds(daily), 1800);
  assert.deepEqual(
    daily.blocks.map((b) => b.durationSeconds),
    [900, 900],
  );
  assert.deepEqual(
    daily.blocks.map((b) => b.pattern.events.map((e) => e.action)),
    [
      ['down', 'up', 'down', 'up'],
      ['down', 'up', 'mute', 'up'],
    ],
  );
  assert.ok(daily.blocks.every((b) => b.type === 'strumming' && b.breakSeconds === 0));
});
test('actions and rhythmic placement are independent and survive serialization', () => {
  const data = emptyStudio();
  const pattern = copy(PRESET_PATTERNS[1]!);
  pattern.events[1]!.beat = 0.5;
  pattern.events[2]!.beat = 1.75;
  pattern.events[3]!.beat = 3.5;
  pattern.events.push({ id: 'rest', action: 'rest', beat: 2.25 });
  data.patterns.push({ ...pattern, id: 'custom' });
  assert.equal(patternError(pattern), null);
  assert.deepEqual(decodeStudio(JSON.stringify(data)).patterns.at(-1)!.events, pattern.events);
  const timeline = patternTimeline(pattern);
  assert.equal(timeline.find((step) => 1.74 >= step.beat && 1.74 < step.end)!.events.length, 0);
  assert.equal(
    timeline.find((step) => 1.75 >= step.beat && 1.75 < step.end)!.events[0]!.action,
    'mute',
  );
  pattern.events[1]!.beat = 0;
  assert.match(patternError(pattern)!, /one action/);
});
test('G and D fingerings include the specified fingers and thumb bass/mute choices round-trip', () => {
  assert.deepEqual(
    DEFAULT_CHORDS[0]!.strings.map((s) => [s.string, s.fret, s.finger]),
    [
      [6, 3, '2'],
      [5, 2, '1'],
      [4, 0, null],
      [3, 0, null],
      [2, 3, '3'],
      [1, 3, '4'],
    ],
  );
  assert.deepEqual(
    DEFAULT_CHORDS[1]!.strings.slice(3).map((s) => [s.string, s.fret, s.finger]),
    [
      [3, 2, '1'],
      [2, 3, '3'],
      [1, 2, '2'],
    ],
  );
  for (const fret of [2, null]) {
    const data = emptyStudio();
    data.chords[1]!.strings[0] = { string: 6, fret, finger: 'T' };
    assert.deepEqual(decodeStudio(JSON.stringify(data)).chords[1]!.strings[0], {
      string: 6,
      fret,
      finger: 'T',
    });
  }
});
test('chord progression switches after configurable bars and loops independently of pattern length', () => {
  const progression = [
    { chordId: 'G' as const, bars: 2 },
    { chordId: 'D' as const, bars: 1 },
  ];
  assert.equal(chordAt(progression, 7.99, 4)!.chordId, 'G');
  assert.equal(chordAt(progression, 8, 4)!.chordId, 'D');
  assert.equal(chordAt(progression, 12, 4)!.chordId, 'G');
  assert.equal(chordAt(progression, 6, 3)!.chordId, 'D');
});
test('count-ins and breaks are excluded while delayed ticks reconcile every boundary accurately', () => {
  const initial = createSession(routine([10, 20], [5, 0]), now, true, true);
  const counting = advanceSession(initial, now + 3000);
  assert.equal(counting.phase, 'count-in');
  assert.equal(activeMs(counting), 0);
  const second = advanceSession(initial, now + 25000);
  // 4 count-in + 10 exercise + 5 break + 4 count-in + 2 exercise.
  assert.equal(second.blockIndex, 1);
  assert.equal(second.phase, 'exercise');
  assert.deepEqual(
    second.results.map((r) => r.activeMs),
    [10000, 2000],
  );
  const finished = advanceSession(initial, now + 120000);
  assert.equal(finished.phase, 'finished');
  assert.equal(activeMs(finished), 30000);
  assert.equal(finished.endedAt, new Date(now + 43000).toISOString());
});
test('pausing credits only time up to the pause and resumes without counting time away', () => {
  let s = createSession(routine(), now, true, false);
  s = pauseSession(s, now + 2500);
  assert.equal(activeMs(s), 2500);
  assert.equal(advanceSession(s, now + 600000), s);
  s = resumeSession(s, now + 600000);
  s = advanceSession(s, now + 601500);
  assert.equal(activeMs(s), 4000);
  assert.equal(s.phaseElapsedMs, 4000);
});
test('pausing during a count-in or break freezes that phase too', () => {
  const initial = createSession(routine([2, 2], [3, 0]), now, true, true);
  const count = pauseSession(initial, now + 1500);
  assert.equal(count.phaseElapsedMs, 1500);
  assert.equal(activeMs(count), 0);
  let s = advanceSession(resumeSession(count, now + 60000), now + 64500);
  assert.equal(s.phase, 'break');
  assert.equal(activeMs(s), 2000);
  s = pauseSession(s, now + 65000);
  assert.equal(s.phaseElapsedMs, 500);
  assert.equal(activeMs(advanceSession(s, now + 999999)), 2000);
});
test('skipping preserves partial actual duration without awarding uncompleted time', () => {
  let s = createSession(routine(), now, true, false);
  s = skipBlock(s, now + 2500);
  assert.equal(s.results[0]!.state, 'skipped');
  assert.equal(s.results[0]!.activeMs, 2500);
  assert.equal(s.blockIndex, 1);
  assert.equal(s.phaseElapsedMs, 0);
  s = advanceSession(s, now + 22500);
  assert.equal(s.phase, 'finished');
  assert.equal(activeMs(s), 22500);
});
test('skipping while paused does not start playback, and skipping count-in credits zero', () => {
  const s = skipBlock(pauseSession(createSession(routine(), now), now + 1000), now + 100000);
  assert.equal(s.anchorMs, null);
  assert.equal(activeMs(s), 0);
  assert.equal(s.results[0]!.state, 'skipped');
});
test('manual confirmation halts advancement and excludes all waiting time', () => {
  let s = createSession(routine([2, 3], [1, 0]), now, false, false);
  s = advanceSession(s, now + 90000);
  assert.equal(s.phase, 'confirm');
  assert.equal(s.blockIndex, 0);
  assert.equal(activeMs(s), 2000);
  s = confirmSession(s, now + 100000);
  assert.equal(s.phase, 'break');
  s = advanceSession(s, now + 104000);
  assert.equal(s.phase, 'confirm');
  assert.equal(activeMs(s), 5000);
  s = confirmSession(s, now + 105000);
  assert.equal(s.phase, 'finished');
});
test('ending early persists partial results, snapshots isolate history from routine edits', () => {
  const r = routine();
  let s = createSession(r, now, true, false);
  r.blocks[0]!.name = 'Changed later';
  r.blocks[0]!.bpm = 160;
  s = endSession(s, now + 7000);
  assert.equal(s.results[0]!.state, 'partial');
  assert.equal(s.results[1]!.state, 'pending');
  assert.equal(activeMs(s), 7000);
  assert.equal(s.results[0]!.bpm, 60);
  assert.notEqual(s.routine.blocks[0]!.name, r.blocks[0]!.name);
});
test('checkpoints upsert without double counting and cold restoration always pauses', () => {
  let s = createSession(routine(), now, true, false);
  let data = saveSession(emptyStudio(), s);
  s = advanceSession(s, now + 3000);
  data = saveSession(data, s);
  data = saveSession(data, s);
  assert.equal(data.sessions.length, 1);
  const restored = decodeStudio(JSON.stringify(data));
  assert.equal(restored.sessions[0]!.anchorMs, null);
  assert.equal(activeMs(restored.sessions[0]!), 3000);
  assert.equal(restored.activeId, s.id);
  data = saveSession(data, endSession(s, now + 5000));
  assert.equal(data.activeId, null);
  assert.equal(data.sessions.length, 1);
});
test('invalid stored entries and nonfinite timing are rejected without damaging valid history', () => {
  const data = saveSession(
    emptyStudio(),
    endSession(createSession(routine(), now, true, false), now + 1000),
  );
  const corrupted = JSON.parse(JSON.stringify(data));
  corrupted.sessions.push({ ...corrupted.sessions[0], id: 'bad', results: null });
  corrupted.routines.push({ id: 'bad', name: 'Bad', blocks: null });
  corrupted.chords[0].strings[0].fret = 99;
  const restored = decodeStudio(JSON.stringify(corrupted));
  assert.equal(restored.sessions.length, 1);
  assert.equal(restored.routines.length, 1);
  assert.deepEqual(restored.chords[0], DEFAULT_CHORDS[0]);
  assert.throws(() => decodeStudio('{'));
  assert.throws(() => decodeStudio('{"version":999}'));
  const r = routine();
  r.blocks[0]!.bpm = NaN;
  assert.ok(routineError(r));
});
test('weekly summary uses local calendar weeks and includes partial sessions once', () => {
  const saturday = new Date(2026, 9, 24, 12);
  const monday = new Date(2026, 9, 19, 12).getTime();
  const sundayBefore = new Date(2026, 9, 18, 12).getTime();
  const sessions = [
    endSession(createSession(routine([120]), monday, true, false), monday + 60000),
    endSession(createSession(routine([120]), sundayBefore, true, false), sundayBefore + 30000),
  ];
  const summary = weeklySummary(sessions, saturday);
  assert.equal(summary.weekMs, 60000);
  assert.equal(summary.totalMs, 90000);
  assert.equal(summary.days[0]!.activeMs, 60000);
  assert.equal(summary.days[0]!.date.getDay(), 1);
});
test('out-of-order clocks and repeat completion ticks cannot inflate practice duration', () => {
  const initial = createSession(routine([1]), now, true, false);
  assert.equal(advanceSession(initial, now - 1000), initial);
  const done = advanceSession(initial, now + 1000);
  assert.equal(activeMs(done), 1000);
  assert.equal(advanceSession(done, now + 90000), done);
});

test('bundled metronome loops have precise beat spacing and quiet loop boundaries at every supported meter', () => {
  for (const beats of [2, 3, 4, 6]) {
    const wav = readFileSync(new URL(`../assets/audio/metronome/${beats}.wav`, import.meta.url));
    const sampleRate = wav.readUInt32LE(24);
    const frames = wav.readUInt32LE(40) / 2;
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(frames / sampleRate, beats * 0.75);
    for (const bpm of [40, 80, 160])
      assert.equal(frames / sampleRate / (bpm / 80), (beats * 60) / bpm);
    for (let beat = 0; beat < beats; beat++) {
      const onset = beat * sampleRate * 0.75;
      const click = Array.from({ length: 400 }, (_, i) =>
        Math.abs(wav.readInt16LE(44 + (onset + i) * 2)),
      );
      assert.ok(Math.max(...click) > 10000);
      assert.equal(wav.readInt16LE(44 + (onset + sampleRate / 2) * 2), 0);
    }
    const firstClick = wav.subarray(44, 44 + 400 * 2);
    const regularOnset = sampleRate * 0.75;
    const regularClick = wav.subarray(44 + regularOnset * 2, 44 + (regularOnset + 400) * 2);
    assert.notDeepEqual(firstClick, regularClick, 'Beat 1 must have a different sound');
    const accentTail = Array.from({ length: sampleRate * 0.03 }, (_, i) =>
      Math.abs(wav.readInt16LE(44 + (sampleRate * 0.04 + i) * 2)),
    );
    assert.ok(Math.max(...accentTail) > 1000, 'The bar marker must ring longer than a click');
    for (let beat = 1; beat < beats; beat++) {
      const onset = beat * sampleRate * 0.75;
      assert.deepEqual(wav.subarray(44 + onset * 2, 44 + (onset + 400) * 2), regularClick);
      assert.equal(wav.readInt16LE(44 + (onset + sampleRate * 0.04) * 2), 0);
    }
    assert.equal(wav.readInt16LE(wav.length - 2), 0);
  }
});
