import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { ActionButton, Eyebrow } from '../../components/Controls';
import { usePreferences } from '../settings/usePreferences';
import { ChordDiagram } from './ChordDiagram';
import { chordAt, clockTime, routineSeconds } from './model';
import { PatternStrip } from './PatternEditor';
import {
  activeMs,
  advanceSession,
  confirmSession,
  createSession,
  endSession,
  pauseSession,
  phaseDuration,
  resumeSession,
  skipBlock,
  setSessionPractice,
  type PracticeSession,
} from './session';
import { useStudio } from './StudioProvider';
import { ProgressBar, s, StudioPage, Toggle } from './StudioShared';
import { saveSession, studioDayMs } from './storage';
import { useMetronome } from './useMetronome';
import { createPracticeClock } from './practiceTime';
import { usePracticeDay } from './usePracticeDay';
import { MetronomeControls, PracticeTimer } from './MetronomeControls';

export default function SessionPlayer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, ready } = useStudio();
  const initial = data.sessions.find((s) => s.id === (id ?? data.activeId));
  return (
    <StudioPage title="Just you. Your guitar.">
      {ready &&
        (initial ? (
          <Player key={initial.id} initial={initial} />
        ) : (
          <Text style={s.body}>No saved session found. Choose a routine in Routines to begin.</Text>
        ))}
    </StudioPage>
  );
}
function Player({ initial }: { initial: PracticeSession }) {
  const { data, change } = useStudio();
  const { preferences } = usePreferences();
  const [now] = useState(() => createPracticeClock());
  const [session, setSession] = useState(initial);
  const latest = useRef(initial);
  const lastSave = useRef(0);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const persist = useCallback(
    (next: PracticeSession) => {
      lastSave.current = now();
      change((d) => saveSession(d, next));
    },
    [change, now],
  );
  const commit = useCallback(
    (next: PracticeSession, save = true) => {
      latest.current = next;
      setSession(next);
      if (save) persist(next);
    },
    [persist],
  );
  const pause = useCallback(
    (reason?: string) => {
      if (latest.current.phase === 'finished') return;
      commit(pauseSession(latest.current, now(), reason));
    },
    [commit, now],
  );
  const block = session.routine.blocks[session.blockIndex]!;
  const running = session.anchorMs !== null;
  const audible = running && (session.phase === 'count-in' || session.phase === 'exercise');
  const audio = useMetronome({
    ...data.metronome,
    running: audible,
    bpm: block.bpm,
    beatsPerBar: block.pattern.beatsPerBar,
    muted: !data.settings.metronome,
    offsetMs:
      session.phaseElapsedMs +
      (session.phase === 'exercise' && session.countIn
        ? (block.pattern.beatsPerBar * 60000) / block.bpm
        : 0),
    transportKey: `${session.id}-${session.blockIndex}`,
    onInterrupt: pause,
  });
  const stopAudio = audio.stop;
  useFocusEffect(
    useCallback(
      () => () => {
        stopAudio();
        // A finished/restarted session must never overwrite the next active session on cleanup.
        if (latest.current.phase !== 'finished') {
          const paused = pauseSession(latest.current, now());
          latest.current = paused;
          persist(paused);
        }
      },
      [stopAudio, persist, now],
    ),
  );
  useEffect(() => {
    const timer = setInterval(() => {
      const previous = latest.current;
      const time = now();
      const next = advanceSession(previous, time);
      if (next === previous) return;
      const transitioned = next.phase !== previous.phase || next.blockIndex !== previous.blockIndex;
      if (
        transitioned &&
        next.notice &&
        next.notice !== previous.notice &&
        preferences.haptics &&
        Platform.OS !== 'web'
      )
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      commit(next, transitioned || time - lastSave.current >= 5000);
    }, 100);
    return () => clearInterval(timer);
  }, [commit, preferences.haptics, now]);
  const total = routineSeconds(session.routine) * 1000;
  const practiced = activeMs(session);
  const today = usePracticeDay();
  const savedSession = data.sessions.find((s) => s.id === session.id);
  const todayMs =
    studioDayMs(data, today) - (savedSession?.dailyMs[today] ?? 0) + (session.dailyMs[today] ?? 0);
  const resolved = session.results.reduce(
    (sum, result, i) =>
      sum +
      (result.state === 'skipped' || result.state === 'completed'
        ? session.routine.blocks[i]!.durationSeconds * 1000
        : result.activeMs),
    0,
  );
  const upcoming = session.routine.blocks[session.blockIndex + 1];
  const exerciseBeat =
    session.phase === 'exercise'
      ? running
        ? Math.max(0, audio.totalBeat - (session.countIn ? block.pattern.beatsPerBar : 0))
        : (session.phaseElapsedMs * block.bpm) / 60000
      : 0;
  const visualBeat = exerciseBeat;
  const currentChord = chordAt(block.progression, exerciseBeat, block.pattern.beatsPerBar);
  const finished = session.phase === 'finished';
  const toggle = () => {
    audio.stop();
    if (running) pause();
    else commit(resumeSession(latest.current, now()));
  };
  return (
    <>
      <View style={s.section}>
        <Eyebrow>{session.routine.name.toUpperCase()}</Eyebrow>
        <ProgressBar
          value={resolved / total}
          label={`Routine progress · ${Math.min(session.blockIndex + 1, session.results.length)} of ${session.results.length} exercises`}
        />
        <Text style={s.caption}>
          {clockTime(practiced)} actually practiced / {clockTime(total)} planned
        </Text>
      </View>
      {session.notice && (
        <View
          style={[s.card, s.selected]}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
        >
          <Text style={s.body}>{session.notice}</Text>
        </View>
      )}
      {audio.error && (
        <View style={s.warning} accessibilityRole="alert">
          <Text style={[s.body, s.error]}>{audio.error}</Text>
        </View>
      )}
      {!finished ? (
        <View style={s.card}>
          <Text style={s.badge}>
            {session.phase === 'count-in'
              ? 'ONE-BAR COUNT-IN'
              : session.phase === 'break'
                ? 'TAKE A BREATH'
                : session.phase === 'confirm'
                  ? 'EXERCISE COMPLETE'
                  : running
                    ? 'NOW PRACTICING'
                    : 'PAUSED · READY TO PRACTICE'}
          </Text>
          <Text accessibilityRole="header" style={[s.cardTitle, s.center]}>
            {session.phase === 'break' ? `Break after ${block.name}` : block.name}
          </Text>
          <Text
            accessibilityLabel={`${session.phase === 'count-in' ? 'Count in' : 'Time remaining'} ${clockTime(session.phase === 'confirm' ? 0 : phaseDuration(session) - session.phaseElapsedMs)}`}
            style={s.timer}
          >
            {clockTime(
              session.phase === 'confirm' ? 0 : phaseDuration(session) - session.phaseElapsedMs,
            )}
          </Text>
          {session.phase === 'count-in' && (
            <Text style={[s.cardTitle, s.center, s.lime]}>
              Count{' '}
              {Math.min(
                block.pattern.beatsPerBar,
                Math.floor((session.phaseElapsedMs * block.bpm) / 60000) + 1,
              )}{' '}
              of {block.pattern.beatsPerBar}
            </Text>
          )}
          {(session.phase === 'exercise' || session.phase === 'count-in') && (
            <>
              {block.type !== 'transitions' && (
                <PatternStrip
                  pattern={block.pattern}
                  subdivision={data.metronome.subdivision}
                  beat={running && session.phase === 'exercise' ? visualBeat : -1}
                />
              )}
              {block.type !== 'strumming' && (
                <View style={s.row}>
                  {data.chords.map((chord) => (
                    <ChordDiagram
                      key={chord.id}
                      chord={chord}
                      active={session.phase === 'exercise' && chord.id === currentChord?.chordId}
                    />
                  ))}
                </View>
              )}
              {block.type !== 'strumming' && (
                <Text style={[s.body, s.center]}>
                  Progression:{' '}
                  {block.progression
                    .map(
                      (step) =>
                        `${step.chordId} · ${step.bars} ${step.bars === 1 ? 'bar' : 'bars'}`,
                    )
                    .join(' → ')}
                </Text>
              )}
              <Text style={[s.statNumber, s.center]}>{block.bpm} BPM</Text>
            </>
          )}
          <PracticeTimer currentMs={practiced} todayMs={todayMs} />
          <View style={s.row}>
            {session.phase === 'confirm' ? (
              <ActionButton
                primary
                icon="arrow-right"
                label={upcoming ? 'Continue to next exercise' : 'Finish routine'}
                onPress={() => commit(confirmSession(latest.current, now()))}
              />
            ) : (
              <ActionButton
                primary
                icon={running ? 'pause' : 'play'}
                label={running ? 'Stop' : 'Start'}
                disabled={!audio.ready}
                onPress={toggle}
              />
            )}
            <ActionButton
              icon="skip-forward"
              label={session.phase === 'break' ? 'Skip break' : 'Skip exercise'}
              onPress={() => {
                audio.stop();
                commit(skipBlock(latest.current, now()));
              }}
            />
          </View>
          <MetronomeControls
            practiceMode={session.practiceEnabled}
            onPracticeMode={(enabled) => commit(setSessionPractice(latest.current, now(), enabled))}
            previewSound={audio.previewSound}
          />
          <Text style={s.caption}>
            Practice Mode starts on for routines. Count-ins and breaks are excluded from practice
            time.
          </Text>
          <Text style={s.caption}>
            {upcoming
              ? `Up next: ${upcoming.name} · ${clockTime(upcoming.durationSeconds * 1000)} · ${upcoming.bpm} BPM`
              : 'This is the last exercise.'}
          </Text>
          <Text style={s.caption}>
            Pausing freezes the timer and audio. Practice also pauses while the app is in the
            background.
          </Text>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.cardTitle}>
            {session.results.every((r) => r.state === 'completed')
              ? 'Practice complete.'
              : 'Practice saved.'}
          </Text>
          <Text style={s.timer}>{clockTime(practiced)}</Text>
          <Text style={[s.body, s.center]}>Active practice saved on this device.</Text>
          <ActionButton
            primary
            icon="arrow-left"
            label="Back to routines"
            onPress={() => router.dismissTo('/guitar/routines')}
          />
          <ActionButton
            icon="bar-chart-2"
            label="View history"
            onPress={() => router.replace('/guitar/history')}
          />
        </View>
      )}
      <View style={s.card}>
        <Text style={s.cardTitle}>Your session</Text>
        {session.results.map((result, i) => (
          <View key={result.blockId} style={s.between}>
            <View style={{ flex: 1 }}>
              <Text style={[s.body, i === session.blockIndex && !finished && s.lime]}>
                {i + 1}. {result.name}
              </Text>
              <Text style={s.caption}>
                {result.state} · {result.bpm} BPM
              </Text>
            </View>
            <Text style={s.caption}>{clockTime(result.activeMs)}</Text>
          </View>
        ))}
      </View>
      {!finished && (
        <>
          <Toggle
            label="Advance automatically after this exercise"
            value={session.autoAdvance}
            onChange={(autoAdvance) =>
              commit({ ...advanceSession(latest.current, now()), autoAdvance })
            }
          />
          <ActionButton
            icon="square"
            label="End session & save practice"
            onPress={() => {
              audio.stop();
              commit(endSession(latest.current, now()));
            }}
          />
          <ActionButton
            icon="rotate-ccw"
            label="Restart routine"
            onPress={() => {
              audio.stop();
              pause();
              setRestartConfirm(true);
            }}
          />
          {restartConfirm && (
            <View style={s.warning}>
              <Text style={s.body}>
                Start again from the first exercise? Time already practiced will be saved as a
                separate session.
              </Text>
              <View style={s.row}>
                <ActionButton
                  icon="rotate-ccw"
                  label="Save & restart"
                  onPress={() => {
                    const old = endSession(latest.current, now());
                    latest.current = old;
                    const next = createSession(old.routine, now(), old.autoAdvance, old.countIn);
                    next.anchorMs = null;
                    change((d) => saveSession(saveSession(d, old), next));
                    router.setParams({ id: next.id });
                  }}
                />
                <ActionButton icon="x" label="Cancel" onPress={() => setRestartConfirm(false)} />
              </View>
            </View>
          )}
        </>
      )}
    </>
  );
}
