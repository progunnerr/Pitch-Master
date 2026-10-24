import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Eyebrow, IconButton, Segmented } from '../../components/Controls';
import { TonicPicker } from '../../components/TonicPicker';
import { midiNote, noteName, relativeName, SCALES } from '../../domain/musicTheory';
import { usePitchAudio } from '../audio/usePitchAudio';
import { usePreferences } from '../settings/usePreferences';
import type { Preferences } from '../settings/preferences';
import AnswerWheel from './AnswerWheel';
import {
  answerRound,
  createQuestion,
  hearRound,
  hintRound,
  newRound,
  PRACTICE_MODES,
  revealRound,
  type Difficulty,
  type PracticeKind,
  type PracticeRound,
} from './exercises';
import { usePracticeProgress } from './PracticeProgressProvider';
import { PracticeHeader, ProgressStatus } from './PracticeShared';
import { roundResult } from './progress';
import { styles } from './practiceStyles';

export default function PracticeExercise({ kind }: { kind: PracticeKind }) {
  const { preferences, ready } = usePreferences();
  const progress = usePracticeProgress();
  if (!ready || !progress.ready)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <PracticeHeader exercise />
          <ProgressStatus />
          {!ready && <Text style={styles.subtitle}>Loading your listening settings…</Text>}
        </View>
      </SafeAreaView>
    );
  return <ExerciseSession kind={kind} preferences={preferences} />;
}

function ExerciseSession({
  kind,
  preferences: p,
}: {
  kind: PracticeKind;
  preferences: Preferences;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const audio = usePitchAudio(p.octave, p.volume);
  const { playSequence, stop } = audio;
  const { progress, record } = usePracticeProgress();
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [sa, setSa] = useState(p.tonic);
  const [picker, setPicker] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [listening, setListening] = useState<'prompt' | 'reference' | 'ladder' | null>(null);
  const [wheelSize, setWheelSize] = useState(Math.min(width - 88, 380));
  const serial = useRef(0);
  const [session] = useState(
    () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [roundNumber, setRoundNumber] = useState(1);
  const request = useRef(0);
  const [round, setRound] = useState(() =>
    newRound(
      createQuestion(kind, {
        id: `${session}:0`,
        octave: p.octave,
        tonic: p.tonic,
        difficulty: 'beginner',
        accidentals: p.accidentals,
      }),
    ),
  );
  const current = useRef(round);
  const q = round.question;
  const complete = round.status !== 'open';
  const stats = progress.modes[kind];
  const mode = PRACTICE_MODES[kind];

  const silence = useCallback(() => {
    request.current++;
    stop();
  }, [stop]);
  useFocusEffect(useCallback(() => () => silence(), [silence]));

  function update(next: PracticeRound) {
    const before = current.current;
    current.current = next;
    setRound(next);
    if (before.status === 'open' && next.status !== 'open') {
      const result = roundResult(next, new Date().toISOString());
      if (result) record(result);
    }
  }

  function nextRound(nextDifficulty = difficulty, nextSa = sa) {
    silence();
    setListening(null);
    setHintVisible(false);
    const next = newRound(
      createQuestion(kind, {
        id: `${session}:${++serial.current}`,
        octave: p.octave,
        tonic: nextSa,
        difficulty: nextDifficulty,
        accidentals: p.accidentals,
        previousTonic: current.current.question.tonic,
      }),
    );
    current.current = next;
    setRound(next);
    setRoundNumber(serial.current + 1);
  }

  async function listen(type: 'prompt' | 'reference' | 'ladder') {
    const question = current.current.question;
    const token = ++request.current;
    if (type === 'ladder') update(hintRound(current.current));
    setListening(type);
    const base = midiNote(question.tonic, question.octave);
    const notes =
      type === 'prompt'
        ? question.promptMidi
        : type === 'reference'
          ? [midiNote(0, question.octave)]
          : [...SCALES.major.ascending, 12].map((interval) => base + interval);
    const finished = await playSequence(notes, type === 'ladder' ? 90 : 80);
    if (token !== request.current || current.current.question.id !== question.id) return;
    setListening(null);
    if (finished && type === 'prompt') update(hearRound(current.current));
  }

  function answer(value: number) {
    const next = answerRound(current.current, value);
    if (next === current.current) return;
    update(next);
    if (next.status === 'correct') {
      silence();
      setListening(null);
    }
    if (p.haptics && Platform.OS !== 'web')
      void Haptics.notificationAsync(
        next.status === 'correct'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
  }

  const guidedInterval =
    listening === 'ladder' && audio.sequencePlaying && audio.playingMidi !== null
      ? audio.playingMidi - midiNote(q.tonic, q.octave)
      : null;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.page, width < 400 && { padding: 16 }]}>
        <PracticeHeader exercise />
        <View style={styles.section}>
          <Eyebrow>LISTEN / COMPARE / DISCOVER</Eyebrow>
          <Text accessibilityRole="header" style={styles.title}>
            {mode.title}
          </Text>
          <Text style={styles.subtitle}>{mode.instruction}</Text>
        </View>
        <ProgressStatus />
        <View style={[styles.workspace, wide && styles.wideWorkspace]}>
          <View style={styles.question}>
            <View style={styles.card}>
              <View style={styles.row}>
                <Eyebrow>{`ROUND ${roundNumber}`}</Eyebrow>
                <Text style={styles.caption}>
                  {complete
                    ? 'Complete'
                    : round.assisted
                      ? 'Learning round · help used'
                      : 'Take your time'}
                </Text>
              </View>
              {kind === 'interval' && (
                <Segmented<Difficulty>
                  label="Interval difficulty"
                  value={difficulty}
                  options={[
                    { value: 'beginner', label: '6 beginner intervals' },
                    { value: 'full', label: 'All 13 intervals' },
                  ]}
                  onChange={(value) => {
                    if (value !== difficulty) {
                      setDifficulty(value);
                      nextRound(value);
                    }
                  }}
                />
              )}
              {kind === 'sargam' && (
                <ActionButton
                  icon="chevron-down"
                  label={`Choose Sa: ${noteName(sa, p.accidentals)}`}
                  onPress={() => setPicker(true)}
                />
              )}
              {kind === 'movableDo' && (
                <Text style={styles.badge}>{noteName(q.tonic, p.accidentals)} = Do · MAJOR</Text>
              )}
              <Text accessibilityRole="header" style={styles.prompt}>
                {q.prompt}
              </Text>
              <View style={styles.row}>
                <ActionButton
                  primary
                  icon={audio.sequencePlaying && listening === 'prompt' ? 'volume-2' : 'play'}
                  label={
                    audio.sequencePlaying && listening === 'prompt'
                      ? 'Playing…'
                      : round.heard
                        ? 'Replay prompt'
                        : 'Listen to prompt'
                  }
                  onPress={() => {
                    void listen('prompt');
                  }}
                  style={{ flexGrow: 1 }}
                />
                <IconButton
                  icon="square"
                  label="Stop practice audio"
                  onPress={() => {
                    silence();
                    setListening(null);
                  }}
                />
              </View>
              {kind === 'tonic' && (
                <ActionButton
                  icon="music"
                  label={`Play reference C${p.octave}`}
                  onPress={() => {
                    void listen('reference');
                  }}
                />
              )}
              {kind === 'sargam' && (
                <View style={styles.section}>
                  <ActionButton
                    icon="music"
                    label="Hear the Sa–Ni ladder (hint)"
                    onPress={() => {
                      void listen('ladder');
                    }}
                  />
                  {guidedInterval !== null && (
                    <Text accessibilityLiveRegion="polite" style={[styles.cardTitle, styles.lime]}>
                      {guidedInterval === 12
                        ? 'Sa · upper octave'
                        : relativeName(guidedInterval, 'sargam')}
                    </Text>
                  )}
                </View>
              )}
              <Text style={styles.caption}>
                {round.heard
                  ? 'Choose an answer below. Replays do not affect your score.'
                  : 'Listen to the whole prompt to unlock your answers.'}
              </Text>
              {audio.audioError && (
                <Text accessibilityRole="alert" style={[styles.body, styles.error]}>
                  {audio.audioError}
                </Text>
              )}
              {kind === 'tonic' || kind === 'movableDo' ? (
                <View
                  onLayout={(event) => setWheelSize(Math.min(400, event.nativeEvent.layout.width))}
                >
                  <AnswerWheel
                    size={Math.max(240, wheelSize)}
                    accidentals={p.accidentals}
                    disabled={!round.heard || complete}
                    wrongAnswers={round.wrongAnswers}
                    correctTarget={complete ? q.target : undefined}
                    publicTonic={kind === 'movableDo' ? q.tonic : undefined}
                    onAnswer={answer}
                  />
                </View>
              ) : (
                <View style={styles.row} accessibilityLabel="Answer choices">
                  {q.choices.map((choice) => {
                    const wrong = round.wrongAnswers.includes(choice.value);
                    const correct = complete && q.target === choice.value;
                    const disabled = !round.heard || complete || wrong;
                    return (
                      <Pressable
                        key={choice.value}
                        accessibilityRole="button"
                        accessibilityLabel={`Answer ${choice.label}`}
                        accessibilityState={{ disabled, selected: correct }}
                        disabled={disabled}
                        onPress={() => answer(choice.value)}
                        style={({ pressed }) => [
                          styles.choice,
                          wrong && styles.wrong,
                          correct && styles.correct,
                          !round.heard && styles.disabled,
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={styles.choiceText}>
                          {choice.label}
                          {wrong ? ' ×' : correct ? ' ✓' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {round.feedback && (
                <View
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                  style={[styles.feedback, !complete && { borderLeftColor: '#FFB4A2' }]}
                >
                  <Text style={[styles.cardTitle, complete ? styles.lime : styles.error]}>
                    {round.status === 'correct'
                      ? 'You found it.'
                      : round.status === 'revealed'
                        ? 'Here’s the relationship.'
                        : 'Keep listening.'}
                  </Text>
                  <Text style={styles.body}>{round.feedback}</Text>
                  {complete && (
                    <Text style={styles.caption}>
                      {!round.assisted && round.wrongAnswers.length === 0
                        ? 'Unaided first-try win. Your streak grows.'
                        : 'Learning round saved. Try the next one without help.'}
                    </Text>
                  )}
                </View>
              )}
              {complete && (
                <ActionButton
                  primary
                  icon="arrow-right"
                  label="Next round"
                  onPress={() => nextRound()}
                />
              )}
            </View>
          </View>
          <View style={[styles.side, wide && styles.wideSide]}>
            <View style={styles.card}>
              <Eyebrow>A LITTLE HELP</Eyebrow>
              <Text style={styles.body}>
                A replay is part of listening. Use a hint whenever you need a way in.
              </Text>
              <ActionButton
                icon="help-circle"
                label="Show hint"
                disabled={complete || hintVisible}
                onPress={() => {
                  setHintVisible(true);
                  update(hintRound(current.current));
                }}
              />
              {hintVisible && (
                <View style={styles.hint}>
                  <Text style={styles.body}>{q.hint}</Text>
                  <Text style={styles.caption}>This counts as an assisted learning round.</Text>
                </View>
              )}
              <ActionButton
                icon="eye"
                label="Reveal answer"
                disabled={!round.heard || complete}
                onPress={() => {
                  silence();
                  setListening(null);
                  update(revealRound(current.current));
                }}
              />
            </View>
            <View style={styles.card}>
              <Eyebrow>YOUR PRACTICE, SAVED</Eyebrow>
              <Text style={styles.statNumber}>
                {stats.streak}
                <Text style={styles.caption}> current streak</Text>
              </Text>
              <Text style={styles.body}>
                {stats.completed} rounds completed{'\n'}
                {stats.firstTryCorrect} unaided first-try wins{'\n'}
                {stats.assisted} assisted rounds{'\n'}
                {stats.revealed} answers revealed
              </Text>
              <Text style={styles.caption}>
                Best streak: {stats.bestStreak}. A streak grows with unaided, first-try answers.
                Completed rounds are saved once on this device.
              </Text>
            </View>
            <Text style={styles.caption}>
              {kind === 'sargam'
                ? 'This exercise uses the shuddha major Sargam ladder in equal temperament. Sing along if you like; the app grades your choice, not your voice.'
                : kind === 'interval'
                  ? 'Intervals are played upward, one note after another. Start with six familiar distances, then try all thirteen from unison to octave.'
                  : 'The wheel stays in chromatic order, with C at the top. Each clockwise step is one semitone.'}
            </Text>
          </View>
        </View>
        <TonicPicker
          visible={picker}
          tonic={sa}
          accidentals={p.accidentals}
          onClose={() => setPicker(false)}
          onSelect={(tonic) => {
            setSa(tonic);
            nextRound(difficulty, tonic);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
