import assert from 'node:assert/strict';
import { test } from 'node:test';
import { absolutePitch, midiNote, SCALES } from '../src/domain/musicTheory/index.ts';
import {
  answerRound,
  BEGINNER_INTERVALS,
  createQuestion,
  hearRound,
  hintRound,
  isPracticeKind,
  newRound,
  PRACTICE_KINDS,
  revealRound,
  type PracticeKind,
} from '../src/features/practice/exercises.ts';
import {
  decodeProgress,
  emptyProgress,
  progressTotals,
  recordResult,
  roundResult,
  type RoundResult,
} from '../src/features/practice/progress.ts';

const options = {
  id: 'round-1',
  octave: 4,
  tonic: 0,
  difficulty: 'beginner' as const,
  accidentals: 'sharps' as const,
};
const question = (kind: PracticeKind = 'tonic') => createQuestion(kind, options, () => 0);

test('all exercise types generate playable questions and valid choices across every tonic and octave', () => {
  for (const kind of PRACTICE_KINDS)
    for (const octave of [3, 4, 5])
      for (let tonic = 0; tonic < 12; tonic++) {
        const randomValues = [tonic / 12, 0.999];
        const q = createQuestion(
          kind,
          { ...options, octave, tonic },
          () => randomValues.shift() ?? 0,
        );
        assert.ok(q.choices.some((choice) => choice.value === q.target));
        assert.ok(q.promptMidi.every((midi) => Number.isInteger(midi) && midi >= 48 && midi <= 95));
        assert.equal(q.promptMidi[0], midiNote(q.tonic, octave));
        assert.equal(new Set(q.choices.map((choice) => choice.value)).size, q.choices.length);
      }
});

test('beginner intervals are restricted, full range includes every distance through the octave', () => {
  assert.deepEqual(
    question('interval').choices.map((choice) => choice.value),
    BEGINNER_INTERVALS,
  );
  for (let interval = 0; interval <= 12; interval++) {
    const values = [0, interval / 13];
    const q = createQuestion('interval', { ...options, difficulty: 'full' }, () => values.shift()!);
    assert.equal(q.target, interval);
    assert.equal(q.promptMidi[1]! - q.promptMidi[0]!, interval);
    assert.equal(q.choices.length, 13);
  }
});

test('Sargam keeps the chosen Sa and uses all seven shuddha major syllables', () => {
  for (let degree = 0; degree < 7; degree++) {
    const q = createQuestion('sargam', { ...options, tonic: 8 }, () => degree / 7);
    assert.equal(q.tonic, 8);
    assert.equal(q.target, SCALES.major.ascending[degree]);
    assert.equal(q.promptMidi[1]! - q.promptMidi[0]!, q.target);
    assert.deepEqual(
      q.choices.map((choice) => choice.label),
      ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'],
    );
  }
});

test('movable Do chooses a different tonic and maps the requested degree onto absolute pitch', () => {
  for (let previousTonic = 0; previousTonic < 12; previousTonic++)
    for (let degree = 0; degree < 6; degree++) {
      const values = [previousTonic / 12, degree / 6];
      const q = createQuestion('movableDo', { ...options, previousTonic }, () => values.shift()!);
      assert.notEqual(q.tonic, previousTonic);
      assert.notEqual(q.targetInterval, 0);
      assert.equal(q.target, absolutePitch(q.tonic, q.targetInterval));
      assert.equal(q.promptMidi[1]! - q.promptMidi[0]!, q.targetInterval);
    }
});

test('a full prompt must be heard before answering or revealing', () => {
  const round = newRound(question());
  assert.equal(answerRound(round, round.question.target), round);
  assert.equal(revealRound(round), round);
  assert.equal(roundResult(round, '2026-10-24T00:00:00Z'), null);
  assert.equal(answerRound(hearRound(round), round.question.target).status, 'correct');
});

test('wrong attempts stay open, give feedback, and cannot be counted twice', () => {
  const round = hearRound(newRound(question()));
  const wrong = answerRound(round, 1);
  assert.equal(wrong.status, 'open');
  assert.deepEqual(wrong.wrongAnswers, [1]);
  assert.ok(wrong.feedback);
  assert.equal(answerRound(wrong, 1), wrong);
  assert.equal(answerRound(wrong, 99), wrong);
  const correct = answerRound(wrong, 0);
  assert.equal(correct.status, 'correct');
  assert.equal(answerRound(correct, 0), correct);
  assert.equal(roundResult(correct, '2026-10-24T00:00:00Z')!.attempts, 2);
});

test('hints and revealing mark assistance, completed rounds cannot be regraded', () => {
  const round = hearRound(hintRound(newRound(question())));
  assert.equal(round.assisted, true);
  const revealed = revealRound(round);
  assert.equal(revealed.status, 'revealed');
  assert.equal(revealed.feedback, round.question.explanation);
  assert.equal(answerRound(revealed, 0), revealed);
  assert.equal(hintRound(revealed), revealed);
});

const result = (id: string, changes: Partial<RoundResult> = {}): RoundResult => ({
  id,
  kind: 'tonic',
  attempts: 1,
  assisted: false,
  revealed: false,
  at: '2026-10-24T12:00:00Z',
  ...changes,
});

test('replay and repeated result delivery cannot inflate saved scores', () => {
  const saved = recordResult(emptyProgress(), result('one'));
  assert.equal(recordResult(saved, result('one')), saved);
  assert.deepEqual(progressTotals(saved), { completed: 1, firstTryCorrect: 1, bestStreak: 1 });
  const completedRound = answerRound(hearRound(newRound(question())), 0);
  assert.equal(hearRound(completedRound).status, 'correct');
  assert.equal(roundResult(hearRound(completedRound), result('one').at)!.attempts, 1);
});

test('assistance, retries and reveals reset the current streak while preserving the best', () => {
  let saved = recordResult(emptyProgress(), result('one'));
  saved = recordResult(saved, result('two'));
  saved = recordResult(saved, result('three', { attempts: 2 }));
  saved = recordResult(saved, result('four', { assisted: true }));
  saved = recordResult(saved, result('five', { assisted: true, revealed: true, attempts: 0 }));
  assert.deepEqual(saved.modes.tonic, {
    completed: 5,
    firstTryCorrect: 2,
    assisted: 2,
    revealed: 1,
    answers: 5,
    streak: 0,
    bestStreak: 2,
    lastPracticedAt: result('one').at,
  });
});

test('practice modes maintain independent scores and saved data round-trips', () => {
  let saved = emptyProgress();
  for (const kind of PRACTICE_KINDS) saved = recordResult(saved, result(kind, { kind }));
  assert.deepEqual(decodeProgress(JSON.stringify(saved)), saved);
  assert.equal(progressTotals(saved).completed, 4);
  assert.equal(progressTotals(saved).bestStreak, 1);
});

test('corrupt, unknown and invalid progress fields recover safely', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{"version":2}', '{"version":1,"modes":null}'])
    assert.deepEqual(decodeProgress(raw), emptyProgress());
  const saved = decodeProgress(
    JSON.stringify({
      version: 1,
      modes: {
        tonic: {
          completed: 3,
          firstTryCorrect: 999,
          streak: 999,
          bestStreak: -1,
          assisted: 99,
          revealed: 0.5,
          answers: 'wrong',
          lastPracticedAt: 'invalid',
        },
        interval: { completed: -4 },
      },
      recentRoundIds: ['a', 'a', 42, '', 'x'.repeat(129)],
    }),
  );
  assert.deepEqual(saved.modes.tonic, {
    completed: 3,
    firstTryCorrect: 3,
    streak: 3,
    bestStreak: 3,
    assisted: 3,
    revealed: 0,
    answers: 0,
    lastPracticedAt: null,
  });
  assert.deepEqual(saved.recentRoundIds, ['a']);
  assert.equal(saved.modes.interval.completed, 0);
});

test('recent round history stays bounded and duplicate guard survives a reload', () => {
  let saved = emptyProgress();
  for (let i = 0; i < 200; i++) saved = recordResult(saved, result(`round-${i}`));
  assert.equal(saved.recentRoundIds.length, 128);
  const restored = decodeProgress(JSON.stringify(saved));
  assert.equal(recordResult(restored, result('round-199')), restored);
});

test('route validation accepts only the four exercise modes', () => {
  for (const kind of PRACTICE_KINDS) assert.ok(isPracticeKind(kind));
  for (const invalid of ['unknown', ['tonic'], undefined, 0, '__proto__'])
    assert.equal(isPracticeKind(invalid), false);
});

test('Hindi Sargam practice changes labels without changing pitches or answers', () => {
  const english = createQuestion('sargam', options, () => 0.5);
  const hindi = createQuestion('sargam', { ...options, sargamLanguage: 'hindi' }, () => 0.5);
  assert.deepEqual(hindi.promptMidi, english.promptMidi);
  assert.equal(hindi.target, english.target);
  assert.deepEqual(
    hindi.choices.map((choice) => choice.value),
    english.choices.map((choice) => choice.value),
  );
  assert.deepEqual(
    hindi.choices.map((choice) => choice.label),
    ['सा', 'रे', 'गा', 'मा', 'पा', 'धा', 'नी'],
  );
  assert.match(hindi.prompt, /सा/);
  assert.match(hindi.hint, /सा, रे, गा, मा/);
  assert.match(hindi.explanation, /सा, रे, गा, मा, पा, धा, नी, सा/);
});
