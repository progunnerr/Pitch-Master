import {
  absolutePitch,
  INTERVALS,
  midiNote,
  noteName,
  PITCH_CLASSES,
  relativeName,
  SCALES,
  type Accidentals,
} from '../../domain/musicTheory/index.ts';

export const PRACTICE_KINDS = ['tonic', 'interval', 'sargam', 'movableDo'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];
export type Difficulty = 'beginner' | 'full';
export const PRACTICE_MODES: Record<
  PracticeKind,
  { title: string; description: string; instruction: string }
> = {
  tonic: {
    title: 'Find the tonic',
    description: 'Hear a home note. Find it on the wheel.',
    instruction: 'Compare the mystery note with reference C. Absolute pitch is not required.',
  },
  interval: {
    title: 'Interval recognition',
    description: 'Listen to two notes. Learn the space between.',
    instruction: 'Listen to the distance between notes, rather than their absolute names.',
  },
  sargam: {
    title: 'Sargam practice',
    description: 'Choose Sa. Build a familiar musical ladder.',
    instruction: 'Listen to Sa and a second note, then name its Sargam syllable.',
  },
  movableDo: {
    title: 'Movable Do',
    description: 'A new key. The same relative relationships.',
    instruction: 'Do moves to a new tonic each round. Find the requested syllable on the wheel.',
  },
};
export const BEGINNER_INTERVALS = [0, 2, 4, 5, 7, 12] as const;
export const ALL_INTERVALS = Array.from({ length: 13 }, (_, interval) => interval);
export const intervalName = (interval: number): string =>
  interval === 12 ? 'Octave' : INTERVALS[interval]!;
export function isPracticeKind(value: unknown): value is PracticeKind {
  return typeof value === 'string' && PRACTICE_KINDS.includes(value as PracticeKind);
}

export interface PracticeQuestion {
  id: string;
  kind: PracticeKind;
  tonic: number;
  octave: number;
  target: number;
  targetInterval: number;
  prompt: string;
  promptMidi: readonly number[];
  choices: readonly { value: number; label: string }[];
  hint: string;
  explanation: string;
}

interface QuestionOptions {
  id: string;
  octave: number;
  tonic: number;
  difficulty: Difficulty;
  accidentals: Accidentals;
  previousTonic?: number;
}

function choose<T>(values: readonly T[], random: () => number): T {
  return values[Math.max(0, Math.min(values.length - 1, Math.floor(random() * values.length)))]!;
}

export function createQuestion(
  kind: PracticeKind,
  options: QuestionOptions,
  random = Math.random,
): PracticeQuestion {
  const { id, octave, accidentals } = options;
  const tonic =
    kind === 'sargam'
      ? options.tonic
      : choose(
          PITCH_CLASSES.filter((pitch) => pitch !== options.previousTonic),
          random,
        );
  const base = midiNote(tonic, octave);
  const tonicLabel = noteName(tonic, accidentals);
  const noteChoices = PITCH_CLASSES.map((pitch) => ({
    value: pitch,
    label: noteName(pitch, accidentals),
  }));
  if (kind === 'tonic')
    return {
      id,
      kind,
      tonic,
      octave,
      target: tonic,
      targetInterval: 0,
      prompt: 'Which note is home?',
      promptMidi: [base],
      choices: noteChoices,
      hint: `The mystery note is ${tonic <= 5 ? 'in the C–F half' : 'in the F♯–B half'} of the chromatic wheel. Compare it with reference C.`,
      explanation: `${tonicLabel}${octave} is the tonic: ${tonicLabel} = Sa = Do = 1. Reference C helps you compare the pitches by ear.`,
    };
  if (kind === 'interval') {
    const intervals = options.difficulty === 'beginner' ? BEGINNER_INTERVALS : ALL_INTERVALS;
    const target = choose(intervals, random);
    const secondMidi = base + target;
    return {
      id,
      kind,
      tonic,
      octave,
      target,
      targetInterval: target,
      prompt: 'What is the distance between these notes?',
      promptMidi: [base, secondMidi],
      choices: intervals.map((interval) => ({ value: interval, label: intervalName(interval) })),
      hint:
        target === 0
          ? 'Listen for two matching pitches.'
          : target === 12
            ? 'The two pitches share a note name, in different registers.'
            : `The second note is ${target <= 5 ? 'no higher than a perfect fourth' : 'above a perfect fourth, but below the octave'}. Sing from the first note to the second.`,
      explanation: `${intervalName(target)}: ${target} semitone${target === 1 ? '' : 's'} from ${tonicLabel}${octave} to ${noteName(secondMidi % 12, accidentals)}${Math.floor(secondMidi / 12) - 1}.`,
    };
  }
  if (kind === 'sargam') {
    const target = choose(SCALES.major.ascending, random);
    const syllable = relativeName(target, 'sargam');
    return {
      id,
      kind,
      tonic,
      octave,
      target,
      targetInterval: target,
      prompt: 'Sa, then one more note. Which syllable follows?',
      promptMidi: [base, base + target],
      choices: SCALES.major.ascending.map((interval) => ({
        value: interval,
        label: relativeName(interval, 'sargam'),
      })),
      hint:
        target === 0
          ? 'Listen for the second note returning to Sa.'
          : target <= 5
            ? 'Listen in the lower half of the ladder: Sa, Re, Ga, Ma.'
            : 'Listen in the upper half of the ladder: Pa, Dha, Ni.',
      explanation: `${syllable} is ${target} semitones above Sa (${tonicLabel}). The major Sargam ladder is Sa, Re, Ga, Ma, Pa, Dha, Ni, Sa.`,
    };
  }
  const targetInterval = choose(
    SCALES.major.ascending.filter((interval) => interval !== 0),
    random,
  );
  const target = absolutePitch(tonic, targetInterval);
  const syllable = relativeName(targetInterval, 'solfege');
  return {
    id,
    kind,
    tonic,
    octave,
    target,
    targetInterval,
    prompt: `In ${tonicLabel} major, which absolute note is ${syllable}?`,
    promptMidi: [base, base + targetInterval],
    choices: noteChoices,
    hint: `${tonicLabel} is Do. ${syllable} is ${targetInterval} semitones above Do; count clockwise from ${tonicLabel}.`,
    explanation: `${noteName(target, accidentals)} is ${syllable}, ${targetInterval} semitones above Do (${tonicLabel}). The next round moves Do to a different key.`,
  };
}

export interface PracticeRound {
  question: PracticeQuestion;
  heard: boolean;
  assisted: boolean;
  wrongAnswers: readonly number[];
  status: 'open' | 'correct' | 'revealed';
  feedback: string | null;
}
export const newRound = (question: PracticeQuestion): PracticeRound => ({
  question,
  heard: false,
  assisted: false,
  wrongAnswers: [],
  status: 'open',
  feedback: null,
});
export const hearRound = (round: PracticeRound): PracticeRound => ({ ...round, heard: true });
export const hintRound = (round: PracticeRound): PracticeRound =>
  round.status === 'open' ? { ...round, assisted: true } : round;
export function answerRound(round: PracticeRound, answer: number): PracticeRound {
  if (
    !round.heard ||
    round.status !== 'open' ||
    round.wrongAnswers.includes(answer) ||
    !round.question.choices.some((choice) => choice.value === answer)
  )
    return round;
  if (answer === round.question.target)
    return { ...round, status: 'correct', feedback: round.question.explanation };
  return {
    ...round,
    wrongAnswers: [...round.wrongAnswers, answer],
    feedback: 'Not quite. Replay the notes and try another answer.',
  };
}
export const revealRound = (round: PracticeRound): PracticeRound =>
  !round.heard || round.status !== 'open'
    ? round
    : { ...round, assisted: true, status: 'revealed', feedback: round.question.explanation };
