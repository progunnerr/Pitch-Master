import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Eyebrow, IconButton, Segmented } from './components/Controls';
import { TonicPicker } from './components/TonicPicker';
import {
  DEGREES,
  frequency,
  INTERVALS,
  mod12,
  midiNote,
  noteName,
  relativeDescription,
  scaleRelativeName,
  scaleDegree,
  SCALES,
  relativeSemitone,
  tonicRelationship,
  type Notation,
} from './domain/musicTheory';
import { usePitchAudio } from './features/audio/usePitchAudio';
import { useTonicDrone } from './features/audio/useTonicDrone';
import { ListeningControls } from './features/audio/ListeningControls';
import { ScaleFormula, ScaleSelector } from './features/scales/ScaleExplorer';
import { SettingsPanel } from './features/settings/SettingsPanel';
import { usePreferences } from './features/settings/usePreferences';
import Wheel from './features/wheel/Wheel';
import { colors } from './theme/theme';
import { styles } from './theme/screenStyles';

const NOTATIONS: readonly { value: Notation; label: string }[] = [
  { value: 'solfege', label: 'Solfège' },
  { value: 'sargam', label: 'Sargam' },
  { value: 'degrees', label: 'Degrees' },
];

export default function PitchMaster() {
  const { preferences: p, update, ready, storageError, retrySave } = usePreferences();
  const audio = usePitchAudio(p.octave, p.volume);
  const { playNote, stop: stopNotes } = audio;
  const drone = useTonicDrone(p.tonic, p.octave, p.volume);
  const stopDrone = drone.stop;
  const stop = useCallback(() => {
    stopNotes();
    stopDrone();
  }, [stopNotes, stopDrone]);
  useFocusEffect(useCallback(() => stop, [stop]));
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [selectedPitch, setSelectedPitch] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wheelWidth, setWheelWidth] = useState(Math.min(width - 40, 520));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [workspaceY, setWorkspaceY] = useState(0);
  const [sideY, setSideY] = useState(0);
  const [settingsY, setSettingsY] = useState(0);
  const displayedPitch = audio.playingPitch ?? selectedPitch ?? p.tonic;
  const interval = relativeSemitone(displayedPitch, p.tonic);
  const displayedOctave =
    audio.playingMidi === null ? p.octave : Math.floor(audio.playingMidi / 12) - 1;
  const upperTonic = audio.playingMidi === midiNote(p.tonic, p.octave) + 12;
  const currentDegree = upperTonic
    ? '8'
    : (scaleDegree(interval, p.scale, p.direction) ?? DEGREES[interval]);

  const haptic = useCallback(() => {
    if (p.haptics && Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
  }, [p.haptics]);

  const selectTonic = useCallback(
    (tonic: number) => {
      update('tonic', tonic);
      setSelectedPitch(tonic);
      haptic();
      playNote(tonic);
    },
    [update, haptic, playNote],
  );

  const playPitch = useCallback(
    (pitch: number) => {
      setSelectedPitch(pitch);
      haptic();
      playNote(pitch);
    },
    [haptic, playNote],
  );

  const rotate = useCallback(
    (tonic: number) => {
      stopNotes();
      update('tonic', tonic);
      setSelectedPitch(tonic);
      haptic();
      if (p.soundOnRotate) playNote(tonic);
    },
    [stopNotes, playNote, update, haptic, p.soundOnRotate],
  );

  const snap = useCallback(
    (tonic: number) => {
      haptic();
      if (p.soundOnRotate) playNote(tonic);
    },
    [haptic, p.soundOnRotate, playNote],
  );

  const showSettings = () => {
    setSettingsOpen(true);
    if (!wide)
      requestAnimationFrame(() =>
        scroll.current?.scrollTo({ y: workspaceY + sideY + settingsY - 16, animated: true }),
      );
  };

  if (!ready)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.lime} />
        <Text style={styles.loadingText}>Finding your place…</Text>
      </View>
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.page, !wide && styles.mobilePage]}>
          <View style={[styles.header, !wide && styles.mobileHeader]}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                {[12, 24, 18, 9].map((height, i) => (
                  <View
                    key={i}
                    style={{ width: 3, height, backgroundColor: colors.lime, borderRadius: 2 }}
                  />
                ))}
              </View>
              <Text style={styles.brandName}>
                pitch master<Text style={{ color: colors.lime }}>.</Text>
              </Text>
            </View>
            <View style={styles.headerRight}>
              <IconButton
                icon="headphones"
                label="Open ear training"
                onPress={() => router.push('/practice')}
              />
              {wide && (
                <View style={styles.offlineBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.offlineText}>OFFLINE, IN TUNE</Text>
                </View>
              )}
              <IconButton
                icon="sliders"
                label="Open settings"
                onPress={showSettings}
                selected={settingsOpen}
              />
            </View>
          </View>

          <View style={[styles.intro, !wide && styles.mobileIntro]}>
            <View style={styles.introKicker}>
              <View style={styles.kickerLine} />
              <Eyebrow>THE CHROMATIC EXPLORER</Eyebrow>
            </View>
            <Text accessibilityRole="header" style={[styles.title, !wide && styles.mobileTitle]}>
              Every note, connected.
            </Text>
            <Text style={styles.subtitle}>A new way to see music. A better way to hear it.</Text>
          </View>

          <View style={{ marginBottom: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <ActionButton
              icon="activity"
              label="Strumming & rhythm"
              style={{ flexGrow: 1 }}
              onPress={() => router.navigate('/guitar/trainer')}
            />
            <ActionButton
              icon="grid"
              label="G → D chord changes"
              style={{ flexGrow: 1 }}
              onPress={() => router.navigate('/guitar/chords')}
            />
          </View>

          <View
            style={[styles.workspace, !wide && styles.mobileWorkspace]}
            onLayout={(event) => setWorkspaceY(event.nativeEvent.layout.y)}
          >
            <View
              style={styles.wheelColumn}
              onLayout={(event) => setWheelWidth(Math.min(event.nativeEvent.layout.width, 530))}
            >
              <View style={styles.notationControls}>
                <Segmented
                  label="Notation system"
                  options={NOTATIONS}
                  value={p.notation}
                  onChange={(value) => {
                    stopNotes();
                    update('notation', value);
                    haptic();
                  }}
                />
              </View>
              <ScaleSelector
                scale={p.scale}
                onChange={(value) => {
                  stopNotes();
                  update('scale', value);
                  haptic();
                }}
              />
              <View style={styles.wheelWrap}>
                <Wheel
                  size={Math.max(250, wheelWidth)}
                  tonic={p.tonic}
                  octave={p.octave}
                  notation={p.notation}
                  accidentals={p.accidentals}
                  convention={p.solfegeConvention}
                  playingPitch={audio.playingPitch}
                  scale={p.scale}
                  direction={p.direction}
                  onSelectTonic={selectTonic}
                  onPlayPitch={playPitch}
                  onRotate={rotate}
                  onSnap={snap}
                />
              </View>
              <View style={styles.wheelLegend}>
                <View style={styles.legendItem}>
                  <View style={styles.legendDot} />
                  <Text style={styles.legendText}>Absolute pitch</Text>
                </View>
                <View style={styles.legendDivider} />
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.lime }]} />
                  <Text style={styles.legendText}>Tonic / scale notes</Text>
                </View>
              </View>
              <View style={styles.gestureHint}>
                <Feather name="move" size={13} color={colors.faint} />
                <Text style={styles.gestureHintText}>Drag the inner ring. Discover a new key.</Text>
              </View>
              <ScaleFormula
                scale={p.scale}
                direction={p.direction}
                convention={p.solfegeConvention}
              />
            </View>

            <View
              style={[styles.sideColumn, !wide && styles.mobileSide]}
              onLayout={(event) => setSideY(event.nativeEvent.layout.y)}
            >
              <View style={styles.controlCard}>
                <View style={styles.cardBody}>
                  <View style={styles.tonicHeading}>
                    <Eyebrow>YOUR POINT OF REFERENCE</Eyebrow>
                    <View style={styles.smallBadge}>
                      <Text style={styles.smallBadgeText}>TONIC</Text>
                    </View>
                  </View>
                  <View style={styles.tonicRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Choose tonic, currently ${noteName(p.tonic, p.accidentals)}`}
                      onPress={() => setPickerOpen(true)}
                      style={styles.tonicButton}
                    >
                      <Text style={styles.tonicLarge}>{noteName(p.tonic, p.accidentals)}</Text>
                      <Feather name="chevron-down" size={18} color={colors.muted} />
                    </Pressable>
                    <View style={styles.tonicMetadata}>
                      <Text style={styles.tonicOctave}>Octave {p.octave}</Text>
                      <Text style={styles.tonicHz}>
                        {frequency(p.tonic, p.octave).toFixed(2)} Hz
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={styles.relationship}
                    accessibilityLabel={tonicRelationship(p.tonic, p.accidentals)}
                  >
                    {noteName(p.tonic, p.accidentals)} <Text style={styles.equals}>=</Text> Sa{' '}
                    <Text style={styles.equals}>=</Text> Do <Text style={styles.equals}>=</Text> 1
                  </Text>
                  <Text style={styles.relationshipHint}>One pitch. Three musical languages.</Text>

                  <View style={styles.divider} />
                  <View style={styles.labelRow}>
                    <Eyebrow>
                      {audio.playingMidi !== null ? 'NOW PLAYING' : 'SELECTED NOTE'}
                    </Eyebrow>
                    <View
                      style={[
                        styles.soundDot,
                        audio.playingMidi !== null && { backgroundColor: colors.lime },
                      ]}
                    />
                  </View>
                  <View style={styles.selectedRow}>
                    <Text style={styles.selectedNote}>
                      {noteName(displayedPitch, p.accidentals)}
                      <Text style={styles.octaveNumber}>{displayedOctave}</Text>
                    </Text>
                    <View style={styles.intervalDetails}>
                      <Text style={styles.intervalName}>
                        {upperTonic ? 'Octave' : INTERVALS[interval]}
                      </Text>
                      <Text style={styles.noteHz}>
                        {frequency(displayedPitch, displayedOctave).toFixed(2)} Hz · {currentDegree}
                        {upperTonic ? ' (octave)' : interval === 0 ? ' (tonic)' : ' degree'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.translations}>
                    <Text style={styles.translation}>
                      {scaleRelativeName(
                        interval,
                        'solfege',
                        p.scale,
                        p.direction,
                        p.solfegeConvention,
                      )}{' '}
                      <Text style={styles.translationDim}>/</Text>{' '}
                      {relativeDescription(interval, 'sargam')}{' '}
                      <Text style={styles.translationDim}>/</Text> {currentDegree}
                    </Text>
                  </View>
                  <View style={styles.playRow}>
                    <ActionButton
                      primary
                      label="Play note"
                      icon="volume-2"
                      onPress={() => playPitch(displayedPitch)}
                      style={{ flex: 1 }}
                    />
                    <IconButton icon="square" label="Stop all audio" onPress={stop} />
                  </View>

                  <View style={styles.rotationRow}>
                    <IconButton
                      icon="rotate-ccw"
                      label="Rotate tonic counterclockwise"
                      onPress={() => rotate(mod12(p.tonic - 1))}
                    />
                    <View style={styles.rotationText}>
                      <Text style={styles.rotationTitle}>Change your perspective</Text>
                      <Text style={styles.rotationCaption}>One semitone at a time</Text>
                    </View>
                    <IconButton
                      icon="rotate-cw"
                      label="Rotate tonic clockwise"
                      onPress={() => rotate(mod12(p.tonic + 1))}
                    />
                  </View>
                </View>
                <View onLayout={(event) => setSettingsY(event.nativeEvent.layout.y)}>
                  <SettingsPanel
                    preferences={p}
                    update={update}
                    expanded={settingsOpen}
                    onToggle={() => setSettingsOpen(!settingsOpen)}
                  />
                </View>
              </View>

              <ListeningControls
                scaleName={SCALES[p.scale].name}
                noteCount={SCALES[p.scale].ascending.length}
                direction={p.direction}
                tempo={p.tempo}
                sequencePlaying={audio.sequencePlaying}
                onPlayScale={() => {
                  void audio.playScale(p.tonic, p.scale, p.tempo, p.direction);
                }}
                onStopSequence={stopNotes}
                onDirection={(value) => {
                  stopNotes();
                  update('direction', value);
                }}
                tonic={noteName(p.tonic, p.accidentals)}
                octave={p.octave}
                droneEnabled={drone.enabled}
                droneLoading={drone.loading}
                onToggleDrone={drone.toggle}
              />
              {(audio.audioError || drone.error || storageError) && (
                <View style={styles.errorCard} accessibilityRole="alert">
                  <Text style={styles.errorText}>
                    {audio.audioError || drone.error || storageError}
                  </Text>
                  {storageError && (
                    <ActionButton icon="refresh-cw" label="Retry saving" onPress={retrySave} />
                  )}
                </View>
              )}
            </View>
          </View>

          <View style={[styles.footer, !wide && styles.mobileFooter]}>
            <View style={styles.footerTip}>
              <Feather name="info" size={14} color={colors.muted} />
              <Text style={styles.footerText}>
                Tap an outer note to make it home. Tap an inner note to hear its relationship.
              </Text>
            </View>
            <Text style={styles.footerSignature}>LESS THEORY. MORE DISCOVERY.</Text>
          </View>
          {p.notation === 'sargam' && (
            <Text style={styles.sargamHelp}>
              Lowercase re, ga, dha, ni = komal (lowered). Ma⁺ = tivra (raised). Pitches use equal
              temperament; raga intonation can vary.
            </Text>
          )}
        </View>
      </ScrollView>
      <TonicPicker
        visible={pickerOpen}
        tonic={p.tonic}
        accidentals={p.accidentals}
        onSelect={selectTonic}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}
