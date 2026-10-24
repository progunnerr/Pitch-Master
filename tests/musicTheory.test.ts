import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  absolutePitch,
  DEGREES,
  frequency,
  midiNote,
  mod12,
  noteName,
  relativeName,
  relativeSemitone,
  SCALES,
  scalePitches,
  tonicRelationship,
} from '../src/domain/musicTheory/index.ts';

for (let tonic = 0; tonic < 12; tonic++) {
  test(`all 12 relative pitches map correctly in tonic ${noteName(tonic)}`, () => {
    for (let degree = 0; degree < 12; degree++) {
      const pitch = absolutePitch(tonic, degree);
      assert.equal(relativeSemitone(pitch, tonic), degree);
      assert.equal(relativeName(relativeSemitone(pitch, tonic), 'degrees'), DEGREES[degree]);
    }
    assert.equal(relativeName(relativeSemitone(tonic, tonic), 'sargam'), 'Sa');
    assert.equal(relativeName(relativeSemitone(tonic, tonic), 'solfege'), 'Do');
    assert.equal(tonicRelationship(tonic, 'sharps'), `${noteName(tonic)} = Sa = Do = 1`);
  });
}

test('wraps both clockwise and counterclockwise across C', () => {
  assert.equal(mod12(-1), 11);
  assert.equal(mod12(25), 1);
  assert.equal(relativeSemitone(0, 11), 1);
  assert.equal(absolutePitch(11, 7), 6);
});

test('keeps accidental spelling separate from pitch and convention', () => {
  assert.equal(noteName(1, 'sharps'), 'C♯');
  assert.equal(noteName(1, 'flats'), 'D♭');
  assert.equal(relativeName(1, 'solfege', 'sharps'), 'Di');
  assert.equal(relativeName(1, 'solfege', 'flats'), 'Ra');
  assert.equal(relativeName(6, 'solfege', 'sharps'), 'Fi');
  assert.equal(relativeName(6, 'solfege', 'flats'), 'Se');
  assert.equal(relativeName(8, 'sargam'), 'dha');
  assert.equal(relativeName(9, 'sargam'), 'Dha');
  assert.equal(relativeName(6, 'sargam'), 'Ma⁺');
  assert.equal(relativeName(11, 'solfege'), 'Ti');
});

test('frequencies use scientific pitch notation and A4 = 440', () => {
  assert.equal(midiNote(0, 4), 60);
  assert.equal(midiNote(9, 4), 69);
  assert.equal(frequency(9, 4), 440);
  assert.ok(Math.abs(frequency(0, 4) - 261.6255653) < 0.000001);
  for (let octave = 3; octave <= 5; octave++) {
    for (let pitch = 0; pitch < 12; pitch++) {
      assert.ok(Math.abs(frequency(pitch, octave + 1) - frequency(pitch, octave) * 2) < 1e-9);
      assert.ok(frequency(pitch, octave) > 0);
    }
  }
  assert.equal(frequency(9, 4, 442), 442);
  assert.throws(() => frequency(0, 4, 0), RangeError);
});

test('scale formulas match standard semitone definitions', () => {
  const expected = {
    major: [0, 2, 4, 5, 7, 9, 11],
    naturalMinor: [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    majorPentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],
    majorBlues: [0, 2, 3, 4, 7, 9],
    minorBlues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };
  for (const scale of Object.keys(expected) as (keyof typeof expected)[]) {
    assert.deepEqual(SCALES[scale].ascending, expected[scale]);
    for (let tonic = 0; tonic < 12; tonic++) {
      const pitches = scalePitches(tonic, scale);
      assert.equal(pitches[0], tonic);
      assert.equal(pitches.at(-1), tonic + 12);
      assert.deepEqual(
        pitches.slice(0, -1).map((pitch) => pitch - tonic),
        expected[scale],
      );
    }
  }
});

test('descending melodic minor lowers degrees 6 and 7 and preserves octave crossings', () => {
  assert.deepEqual(
    scalePitches(11, 'melodicMinor', 'descending'),
    [23, 21, 19, 18, 16, 14, 13, 11],
  );
});
