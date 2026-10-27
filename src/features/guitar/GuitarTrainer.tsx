import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton, Eyebrow } from '../../components/Controls';
import { ChordDiagram, ChordEditor } from './ChordDiagram';
import {
  chordAt,
  copy,
  DEFAULT_PROGRESSION,
  newBlock,
  patternError,
  PRESET_PATTERNS,
  routineError,
  uid,
  type ChordStep,
  type ExerciseType,
  type StrumPattern,
} from './model';
import { PatternEditor, PatternStrip } from './PatternEditor';
import { ProgressionEditor } from './ProgressionEditor';
import { useStudio } from './StudioProvider';
import { Choices, NumberField, s, StudioPage, Toggle } from './StudioShared';
import { useMetronome } from './useMetronome';
import { useFreePractice } from './useFreePractice';
import { MetronomeControls, PracticeTimer } from './MetronomeControls';
import { beatCount } from './metronome';
import { usePracticeDay } from './usePracticeDay';
import { studioDayMs } from './storage';

export default function GuitarTrainer({
  initialType = 'strumming',
}: {
  initialType?: 'strumming' | 'transitions';
}) {
  const { ready } = useStudio();
  return (
    <StudioPage
      home
      title={initialType === 'transitions' ? 'G → D chord transitions.' : 'Strumming & rhythm.'}
    >
      {ready && <Trainer initialType={initialType} />}
    </StudioPage>
  );
}
function Trainer({ initialType }: { initialType: 'strumming' | 'transitions' }) {
  const { data, change } = useStudio();
  const [type, setType] = useState<ExerciseType>(initialType);
  const [pattern, setPattern] = useState<StrumPattern>(() =>
    copy(data.patterns[0] ?? PRESET_PATTERNS[0]!),
  );
  const bpm = data.metronome.bpm;
  const [progression, setProgression] = useState<ChordStep[]>(() => copy(DEFAULT_PROGRESSION));
  const [editing, setEditing] = useState(false);
  const [chordEditor, setChordEditor] = useState<'G' | 'D' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const practice = useFreePractice();
  const { running, elapsedMs: elapsed, setRunning } = practice;
  const pause = useCallback(
    (reason?: string) => {
      setRunning(false);
      if (reason) setMessage(reason);
    },
    [setRunning],
  );
  const audio = useMetronome({
    ...data.metronome,
    running,
    bpm,
    beatsPerBar: pattern.beatsPerBar,
    muted: !data.settings.metronome,
    offsetMs: elapsed,
    onInterrupt: pause,
  });
  const stopAudio = audio.stop;
  useFocusEffect(
    useCallback(
      () => () => {
        stopAudio();
        pause();
      },
      [stopAudio, pause],
    ),
  );
  const reset = () => {
    audio.stop();
    practice.reset();
  };
  const today = usePracticeDay();
  const savedPractice = data.freePractice.find((p) => p.id === practice.practice.id);
  const todayMs =
    studioDayMs(data, today) -
    (savedPractice?.dailyMs[today] ?? 0) +
    (practice.practice.dailyMs[today] ?? 0);
  const countInBeats = data.settings.countIn ? pattern.beatsPerBar : 0;
  const totalBeat = Math.max(
    0,
    (running ? audio.totalBeat : (elapsed * bpm) / 60000) - countInBeats,
  );
  const counting = (elapsed * bpm) / 60000 < countInBeats;
  const current = chordAt(progression, totalBeat, pattern.beatsPerBar);
  const patternBeat = totalBeat;
  const editable = !running;
  return (
    <>
      <View style={s.card}>
        <Eyebrow>METRONOME</Eyebrow>
        <Text accessibilityLiveRegion="polite" style={[s.cardTitle, s.center, s.lime]}>
          {running && counting
            ? `Count in · ${Math.floor((elapsed * bpm) / 60000) + 1} / ${pattern.beatsPerBar}`
            : running
              ? `Beat ${beatCount(Math.floor(audio.beat * data.metronome.subdivision) / data.metronome.subdivision, pattern.beatsPerBar)} · Bar ${Math.floor(totalBeat / pattern.beatsPerBar) + 1}`
              : 'Ready when you are'}
        </Text>
        <NumberField
          label="Tempo (40–160 BPM)"
          value={bpm}
          min={40}
          max={160}
          onChange={(value) => {
            reset();
            change((d) => ({
              ...d,
              metronome: { ...d.metronome, bpm: Math.max(40, Math.min(160, Math.round(value))) },
            }));
          }}
        />
        <View style={s.row}>
          <ActionButton
            primary
            icon={running ? 'pause' : 'play'}
            label={running ? 'Stop' : 'Start'}
            disabled={
              !audio.ready ||
              !!patternError(pattern) ||
              bpm < 40 ||
              bpm > 160 ||
              progression.some((p) => p.bars < 1)
            }
            onPress={() => {
              if (running) {
                audio.stop();
                pause();
              } else {
                setMessage(null);
                setRunning(true);
              }
            }}
          />
          <ActionButton icon="rotate-ccw" label="Reset loop" onPress={reset} />
        </View>
        <PracticeTimer currentMs={practice.practice.activeMs} todayMs={todayMs} />
        <MetronomeControls
          practiceMode={practice.practiceMode}
          onPracticeMode={practice.setPracticeMode}
          previewSound={audio.previewSound}
        />
        {!running && (
          <Toggle
            label="One-bar count-in"
            value={data.settings.countIn}
            onChange={(countIn) => {
              reset();
              change((d) => ({ ...d, settings: { ...d.settings, countIn } }));
            }}
          />
        )}
        {(message || audio.error) && (
          <Text accessibilityRole="alert" style={s.body}>
            {audio.error ?? message}
          </Text>
        )}
        <Text style={s.caption}>
          Practice time counts while Practice Mode and the metronome are on, even when muted.
          Leaving this screen or backgrounding the app pauses practice.
        </Text>
      </View>
      <View style={s.card}>
        <Eyebrow>STRUMMING & CHORD TRANSITIONS</Eyebrow>
        {!running && (
          <Choices
            label="Practice focus"
            value={type}
            options={
              initialType === 'transitions'
                ? [
                    { value: 'transitions', label: 'Chord changes' },
                    { value: 'combined', label: 'With strumming' },
                  ]
                : [
                    { value: 'strumming', label: 'Strumming' },
                    { value: 'combined', label: 'With chords' },
                  ]
            }
            onChange={(v) => {
              reset();
              setType(v);
            }}
          />
        )}
        <Text style={s.subtitle}>↓ downstroke · ↑ upstroke · × percussive mute · – rest</Text>
        {type !== 'transitions' && (
          <PatternStrip
            pattern={pattern}
            subdivision={data.metronome.subdivision}
            beat={running && !counting ? patternBeat : -1}
          />
        )}
        {type !== 'strumming' && (
          <View style={s.row}>
            {data.chords.map((chord) => (
              <ChordDiagram
                key={chord.id}
                chord={chord}
                active={running && !counting && chord.id === current?.chordId}
              />
            ))}
          </View>
        )}
      </View>
      {editable && (
        <>
          <View style={s.card}>
            <Choices
              label="Strumming pattern"
              value={pattern.id}
              options={data.patterns.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(id) => {
                reset();
                setEditing(false);
                setPattern(copy(data.patterns.find((p) => p.id === id)!));
              }}
            />
            <ActionButton
              icon="edit-3"
              label={editing ? 'Close pattern editor' : 'Customize rhythm & placement'}
              onPress={() => setEditing(!editing)}
            />
            {editing && (
              <>
                <PatternEditor
                  pattern={pattern}
                  onChange={(p) => {
                    reset();
                    setPattern(p);
                  }}
                />
                {patternError(pattern) && <Text style={s.error}>{patternError(pattern)}</Text>}
                <ActionButton
                  icon="save"
                  label="Save as custom pattern"
                  disabled={!!patternError(pattern)}
                  onPress={() => {
                    const saved = {
                      ...copy(pattern),
                      id: pattern.id.startsWith('pattern-') ? uid() : pattern.id,
                      name: pattern.name.trim(),
                    };
                    change((d) => ({
                      ...d,
                      patterns: [...d.patterns.filter((p) => p.id !== saved.id), saved],
                    }));
                    setPattern(saved);
                    setMessage('Custom pattern saved.');
                  }}
                />
              </>
            )}
          </View>
          {type !== 'strumming' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Make the change.</Text>
              <ProgressionEditor
                value={progression}
                onChange={(v) => {
                  reset();
                  setProgression(v);
                }}
              />
              <Choices
                label="D major · sixth string / thumb"
                value={
                  data.chords.find((c) => c.id === 'D')!.strings[0]!.fret === 2
                    ? 'bass'
                    : data.chords.find((c) => c.id === 'D')!.strings[0]!.finger === 'T'
                      ? 'mute'
                      : 'omit'
                }
                options={[
                  { value: 'omit', label: 'Omit ×' },
                  { value: 'bass', label: 'F♯ bass · T, fret 2' },
                  { value: 'mute', label: 'Mute with thumb ×' },
                ]}
                onChange={(v) =>
                  change((d) => ({
                    ...d,
                    chords: d.chords.map((c) =>
                      c.id === 'D'
                        ? {
                            ...c,
                            strings: c.strings.map((s) =>
                              s.string === 6
                                ? {
                                    ...s,
                                    fret: v === 'bass' ? 2 : null,
                                    finger: v === 'omit' ? null : 'T',
                                  }
                                : s,
                            ),
                          }
                        : c,
                    ),
                  }))
                }
              />
              <Text style={s.caption}>
                F♯ bass sounds string 6 at fret 2 with your thumb. Thumb mute silences it; the chord
                stays D major.
              </Text>
              <Choices
                label="Edit custom fingering"
                value={chordEditor ?? 'none'}
                options={[
                  { value: 'none', label: 'Hide editor' },
                  { value: 'G', label: 'G major' },
                  { value: 'D', label: 'D major' },
                ]}
                onChange={(v) => setChordEditor(v === 'none' ? null : (v as 'G' | 'D'))}
              />
              {chordEditor && (
                <ChordEditor
                  chord={data.chords.find((c) => c.id === chordEditor)!}
                  onChange={(chord) =>
                    change((d) => ({
                      ...d,
                      chords: d.chords.map((c) => (c.id === chord.id ? chord : c)),
                    }))
                  }
                />
              )}
            </View>
          )}
          <ActionButton
            primary
            icon="plus"
            label="Use this setup in a routine"
            disabled={!!patternError(pattern)}
            onPress={() => {
              const block = {
                ...newBlock(pattern),
                bpm,
                type,
                progression: copy(progression),
                name: type === 'strumming' ? pattern.name : 'G → D transitions',
              };
              const routine = {
                id: uid(),
                name: type === 'strumming' ? 'My strumming practice' : 'G → D practice',
                blocks: [block],
              };
              const error = routineError(routine);
              if (error) {
                setMessage(error);
                return;
              }
              change((d) => ({ ...d, routines: [...d.routines, routine] }));
              router.push({ pathname: '/guitar/routine', params: { id: routine.id } });
            }}
          />
        </>
      )}
    </>
  );
}
