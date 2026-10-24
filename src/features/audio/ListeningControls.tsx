import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton, Segmented } from '../../components/Controls';
import type { Direction } from '../../domain/musicTheory';
import { colors, fonts } from '../../theme/theme';
import { styles } from '../../theme/screenStyles';

export function ListeningControls({
  scaleName,
  noteCount,
  direction,
  tempo,
  sequencePlaying,
  onPlayScale,
  onStopSequence,
  onDirection,
  tonic,
  octave,
  droneEnabled,
  droneLoading,
  onToggleDrone,
}: {
  scaleName: string;
  noteCount: number;
  direction: Direction;
  tempo: number;
  sequencePlaying: boolean;
  onPlayScale: () => void;
  onStopSequence: () => void;
  onDirection: (direction: Direction) => void;
  tonic: string;
  octave: number;
  droneEnabled: boolean;
  droneLoading: boolean;
  onToggleDrone: () => void;
}) {
  return (
    <>
      <View style={styles.listenCard}>
        <View style={styles.listenHeader}>
          <View style={styles.listenIcon}>
            <Feather name="headphones" size={19} color={colors.lime} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.listenTitle}>{scaleName}, by ear</Text>
            <Text style={styles.listenSubtitle}>
              {noteCount} notes · one octave · {tempo} bpm
            </Text>
          </View>
        </View>
        <View style={local.direction}>
          <Segmented
            label="Scale direction"
            value={direction}
            onChange={onDirection}
            options={[
              { value: 'ascending', label: 'Ascending ↑' },
              { value: 'descending', label: 'Descending ↓' },
            ]}
          />
        </View>
        <ActionButton
          label={sequencePlaying ? 'Stop scale' : 'Play scale'}
          icon={sequencePlaying ? 'square' : 'play'}
          onPress={sequencePlaying ? onStopSequence : onPlayScale}
          primary
        />
        <Text style={styles.sequenceCaption}>Returns to the tonic · A4 = 440 Hz</Text>
      </View>
      <View style={[styles.listenCard, droneEnabled && local.activeDrone]}>
        <View style={styles.listenHeader}>
          <View style={styles.listenIcon}>
            <Feather name="radio" size={19} color={colors.lime} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.listenTitle}>Tonic drone</Text>
            <Text style={styles.listenSubtitle} accessibilityLiveRegion="polite">
              {droneLoading
                ? `Starting ${tonic}${octave}…`
                : droneEnabled
                  ? `Holding ${tonic}${octave} · listen against it`
                  : `A steady ${tonic}${octave} to come home to`}
            </Text>
          </View>
          <View style={[local.statusDot, droneEnabled && { backgroundColor: colors.lime }]} />
        </View>
        <View style={local.droneButton}>
          <ActionButton
            label={droneEnabled ? 'Stop drone' : 'Start drone'}
            icon={droneEnabled ? 'square' : 'radio'}
            onPress={onToggleDrone}
          />
        </View>
        <Text style={styles.sequenceCaption}>
          Plays beneath notes and scales. Stops in the background.
        </Text>
      </View>
    </>
  );
}

const local = StyleSheet.create({
  direction: { marginVertical: 16 },
  droneButton: { marginTop: 18 },
  activeDrone: { borderColor: '#7B9C4B', backgroundColor: '#202B17' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.faint },
  label: { fontFamily: fonts.medium },
});
