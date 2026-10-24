import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInScale,
  noteName,
  scaleDegree,
  scaleDegrees,
  scaleIntervals,
  scaleMidiNotes,
  scaleRelativeName,
  scaleSteps,
  SCALES,
  type ScaleId,
} from '../src/domain/musicTheory/index.ts';

const scales = Object.keys(SCALES) as ScaleId[];
for (let tonic = 0; tonic < 12; tonic++) {
  test(`highlights every scale correctly with tonic ${noteName(tonic)} in both directions`, () => {
    for (const scale of scales) {
      for (const direction of ['ascending', 'descending'] as const) {
        const intervals = scaleIntervals(scale, direction);
        const members = Array.from({ length: 12 }, (_, pitch) => pitch).filter((pitch) =>
          isInScale(pitch, tonic, scale, direction),
        );
        assert.equal(members.length, intervals.length);
        assert.ok(members.includes(tonic));
        for (const interval of intervals) assert.ok(members.includes((tonic + interval) % 12));
        const sequence = scaleMidiNotes(tonic, 4, scale, direction);
        assert.ok(sequence.every((midi) => isInScale(midi, tonic, scale, direction)));
      }
    }
  });
}

test('melodic minor changes both membership and interval spelling when descending', () => {
  assert.equal(isInScale(9, 0, 'melodicMinor', 'ascending'), true);
  assert.equal(isInScale(9, 0, 'melodicMinor', 'descending'), false);
  assert.equal(isInScale(8, 0, 'melodicMinor', 'descending'), true);
  assert.deepEqual(scaleDegrees('melodicMinor', 'ascending'), ['1', '2', '♭3', '4', '5', '6', '7']);
  assert.deepEqual(scaleDegrees('melodicMinor', 'descending'), [
    '1',
    '2',
    '♭3',
    '4',
    '5',
    '♭6',
    '♭7',
  ]);
});

test('formulas use the correct degree for each semitone, including the blues flat fifth', () => {
  const semitones: Record<string, number> = {
    '1': 0,
    '♭2': 1,
    '2': 2,
    '♭3': 3,
    '3': 4,
    '4': 5,
    '♯4': 6,
    '♭5': 6,
    '5': 7,
    '♭6': 8,
    '6': 9,
    '♭7': 10,
    '7': 11,
  };
  for (const scale of scales)
    for (const direction of ['ascending', 'descending'] as const) {
      assert.deepEqual(
        scaleDegrees(scale, direction).map((degree) => semitones[degree]),
        scaleIntervals(scale, direction),
      );
    }
  assert.equal(scaleDegree(6, 'minorBlues'), '♭5');
  assert.equal(scaleRelativeName(6, 'solfege', 'minorBlues', 'ascending', 'sharps'), 'Se');
  assert.equal(scaleRelativeName(3, 'solfege', 'naturalMinor', 'ascending', 'sharps'), 'Me');
  assert.equal(scaleRelativeName(3, 'solfege', 'chromatic', 'ascending', 'sharps'), 'Ri');
  assert.equal(scaleRelativeName(3, 'solfege', 'chromatic', 'ascending', 'flats'), 'Me');
});

test('semitone step formulas cover exactly an octave in playback order', () => {
  assert.deepEqual(scaleSteps('major'), [2, 2, 1, 2, 2, 2, 1]);
  assert.deepEqual(scaleSteps('harmonicMinor'), [2, 1, 2, 2, 1, 3, 1]);
  assert.deepEqual(scaleSteps('melodicMinor', 'descending'), [2, 2, 1, 2, 2, 1, 2]);
  for (const scale of scales)
    for (const direction of ['ascending', 'descending'] as const)
      assert.equal(
        scaleSteps(scale, direction).reduce((sum, step) => sum + step, 0),
        12,
      );
});

test('playback preserves octave crossings up to B6 and descends from the upper tonic', () => {
  assert.deepEqual(scaleMidiNotes(11, 5, 'major'), [83, 85, 87, 88, 90, 92, 94, 95]);
  assert.deepEqual(
    scaleMidiNotes(11, 5, 'melodicMinor', 'descending'),
    [95, 93, 91, 90, 88, 86, 85, 83],
  );
});
