import { Canvas, Circle } from '@shopify/react-native-skia';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  PITCH_CLASSES,
  noteName,
  relativeName,
  relativeSemitone,
  SCALES,
  type Accidentals,
} from '../../domain/musicTheory';
import { colors, fonts } from '../../theme/theme';
import { pointOnWheel } from '../wheel/geometry';

export interface AnswerWheelProps {
  size: number;
  accidentals: Accidentals;
  disabled: boolean;
  wrongAnswers: readonly number[];
  correctTarget?: number;
  publicTonic?: number;
  onAnswer: (pitch: number) => void;
}

export default function AnswerWheelCanvas({
  size,
  accidentals,
  disabled,
  wrongAnswers,
  correctTarget,
  publicTonic,
  onAnswer,
}: AnswerWheelProps) {
  const center = size / 2;
  const radius = size * 0.39;
  const completed = correctTarget !== undefined;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Canvas style={StyleSheet.absoluteFill} accessible={false}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          style="stroke"
          strokeWidth={1}
          color={colors.line}
        />
        <Circle cx={center} cy={center} r={size * 0.22} color={colors.surface} />
        <Circle
          cx={center}
          cy={center}
          r={size * 0.22}
          style="stroke"
          strokeWidth={1}
          color={colors.line}
        />
        {PITCH_CLASSES.map((pitch) => {
          const point = pointOnWheel(pitch, radius, center);
          return (
            <Circle
              key={pitch}
              cx={point.x}
              cy={point.y}
              r={22}
              color={
                pitch === correctTarget
                  ? colors.limeDark
                  : wrongAnswers.includes(pitch)
                    ? '#38231F'
                    : colors.elevated
              }
            />
          );
        })}
      </Canvas>
      <View
        pointerEvents="none"
        style={[styles.center, { left: center - size * 0.2, top: center - 36, width: size * 0.4 }]}
      >
        <Text style={styles.centerNote}>
          {publicTonic === undefined
            ? completed
              ? noteName(correctTarget, accidentals)
              : '?'
            : noteName(publicTonic, accidentals)}
        </Text>
        <Text style={styles.centerLabel}>
          {publicTonic === undefined ? (completed ? 'TONIC' : 'MYSTERY TONIC') : '= Do'}
        </Text>
      </View>
      {PITCH_CLASSES.map((pitch) => {
        const point = pointOnWheel(pitch, radius, center);
        const wrong = wrongAnswers.includes(pitch);
        const interval = publicTonic === undefined ? null : relativeSemitone(pitch, publicTonic);
        const syllable =
          completed &&
          interval !== null &&
          SCALES.major.ascending.some((member) => member === interval)
            ? relativeName(interval, 'solfege')
            : null;
        return (
          <Pressable
            key={pitch}
            accessibilityRole="button"
            accessibilityLabel={`Answer ${noteName(pitch, accidentals)}${syllable ? `, ${syllable}` : ''}`}
            accessibilityState={{ disabled: disabled || wrong, selected: pitch === correctTarget }}
            disabled={disabled || wrong}
            onPress={() => onAnswer(pitch)}
            style={({ pressed }) => [
              styles.note,
              { left: point.x - 22, top: point.y - 24 },
              pitch === correctTarget && { borderColor: colors.lime },
              wrong && { borderColor: colors.error },
              !completed && disabled && { opacity: 0.45 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text
              style={[
                styles.noteText,
                pitch === correctTarget && { color: colors.lime },
                wrong && { color: colors.error },
              ]}
            >
              {noteName(pitch, accidentals)}
            </Text>
            {syllable && <Text style={styles.syllable}>{syllable}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', gap: 5 },
  centerNote: { color: colors.lime, fontSize: 34, fontFamily: fonts.displayBold },
  centerLabel: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 0.7,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  note: {
    position: 'absolute',
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  noteText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  syllable: { fontFamily: fonts.medium, fontSize: 9, color: colors.lime },
});
