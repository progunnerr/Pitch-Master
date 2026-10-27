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
  relativeDescription,
  scaleRelativeName,
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
  assert.equal(relativeName(8, 'sargam'), 'D\u0332h\u0332a\u0332');
  assert.equal(relativeName(9, 'sargam'), 'Dha');
  assert.equal(relativeName(6, 'sargam'), 'M\u030Da');
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

test('Hindi Sargam preserves all chromatic distinctions and leaves other notation unchanged', () => {
  const hindi = [
    'सा',
    'रे\u0332',
    'रे',
    'गा\u0332',
    'गा',
    'मा',
    'मा\u030D',
    'पा',
    'धा\u0332',
    'धा',
    'नी\u0332',
    'नी',
  ];
  for (let interval = 0; interval < 12; interval++) {
    assert.equal(relativeName(interval, 'sargam', 'sharps', 'hindi'), hindi[interval]);
    assert.equal(relativeName(interval + 12, 'sargam', 'flats', 'hindi'), hindi[interval]);
    for (const notation of ['solfege', 'degrees'] as const) {
      assert.equal(
        relativeName(interval, notation, 'sharps', 'hindi'),
        relativeName(interval, notation),
      );
    }
  }
  assert.equal(relativeDescription(1, 'sargam', 'sharps', 'hindi'), 'कोमल रे');
  assert.equal(relativeDescription(6, 'sargam', 'sharps', 'hindi'), 'तीव्र मा');
  assert.equal(
    scaleRelativeName(8, 'sargam', 'melodicMinor', 'descending', 'sharps', 'hindi'),
    'धा\u0332',
  );
  assert.equal(tonicRelationship(2, 'sharps', 'hindi'), 'D = सा = Do = 1');
});

test('traditional Sargam marks distinguish only komal and tivra notes in both languages', () => {
  for (const language of ['english', 'hindi'] as const) {
    for (let interval = 0; interval < 12; interval++) {
      const label = relativeName(interval, 'sargam', 'sharps', language);
      assert.equal(label.includes('\u0332'), [1, 3, 8, 10].includes(interval));
      assert.equal(label.includes('\u030D'), interval === 6);
      assert.doesNotMatch(label, /[♭⁺]/);
      const description = relativeDescription(interval, 'sargam', 'sharps', language);
      assert.doesNotMatch(description, /[\u0332\u030D]/);
    }
  }
  assert.equal(relativeDescription(8, 'sargam'), 'komal Dha');
  assert.equal(relativeDescription(6, 'sargam'), 'tivra Ma');
});
