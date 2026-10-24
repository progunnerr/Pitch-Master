import { Canvas, Circle, Group, Line, Path, RadialGradient, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  useExclusiveGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  noteName,
  PITCH_CLASSES,
  relativeDescription,
  scaleRelativeName,
  isInScale,
  SCALES,
  type ScaleId,
  type Direction,
  type Accidentals,
  type Notation,
} from '../../domain/musicTheory';
import { colors, fonts } from '../../theme/theme';
import {
  normalizePitch,
  pitchAtPoint,
  pointOnWheel,
  SEMITONE_ANGLE,
  shortestAngle,
  snappedTonic,
} from './geometry';

export interface WheelProps {
  size: number;
  tonic: number;
  octave: number;
  notation: Notation;
  accidentals: Accidentals;
  convention: Accidentals;
  playingPitch: number | null;
  scale: ScaleId;
  direction: Direction;
  onSelectTonic: (pitch: number) => void;
  onPlayPitch: (pitch: number) => void;
  onRotate: (tonic: number) => void;
  onSnap: (tonic: number) => void;
}

function sector(size: number, pitch: number, inner: number, outer: number): string {
  const center = size / 2;
  const start = (pitch - 0.48) * SEMITONE_ANGLE - Math.PI / 2;
  const end = (pitch + 0.48) * SEMITONE_ANGLE - Math.PI / 2;
  const point = (radius: number, angle: number) =>
    `${center + size * radius * Math.cos(angle)} ${center + size * radius * Math.sin(angle)}`;
  return `M ${point(outer, start)} A ${size * outer} ${size * outer} 0 0 1 ${point(outer, end)} L ${point(inner, end)} A ${size * inner} ${size * inner} 0 0 0 ${point(inner, start)} Z`;
}

function RelativeLabel({
  pitch,
  size,
  rotation,
  text,
  description,
  inScale,
  playing,
  onActivate,
}: {
  pitch: number;
  size: number;
  rotation: SharedValue<number>;
  text: string;
  description: string;
  inScale: boolean;
  playing: boolean;
  onActivate: () => void;
}) {
  const point = pointOnWheel(pitch, size * 0.285, size / 2);
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-rotation.get()}rad` }] }));
  return (
    <View
      style={[styles.label, { left: point.x - 23, top: point.y - 22 }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={description}
      accessibilityHint="Play this relative pitch"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') onActivate();
      }}
    >
      <Animated.Text
        maxFontSizeMultiplier={1.25}
        style={[
          styles.relative,
          !inScale && styles.dimRelative,
          playing && styles.playingLabel,
          { fontSize: size * 0.043 },
          pitch === 0 && styles.tonicLabel,
          upright,
        ]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

export default function ChromaticWheel({
  size,
  tonic,
  octave,
  notation,
  accidentals,
  convention,
  playingPitch,
  scale,
  direction,
  onSelectTonic,
  onPlayPitch,
  onRotate,
  onSnap,
}: WheelProps) {
  const center = size / 2;
  const rotation = useSharedValue(tonic * SEMITONE_ANGLE);
  const previousAngle = useSharedValue(0);
  const previousSnap = useSharedValue(tonic);
  const dragging = useSharedValue(false);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}rad` }] }));
  const ringTransform = useDerivedValue(() => [{ rotate: rotation.get() }]);

  useEffect(() => {
    const target = rotation.get() + shortestAngle(tonic * SEMITONE_ANGLE - rotation.get());
    rotation.set(withTiming(target, { duration: 240 }));
  }, [tonic, rotation]);

  const pan = usePanGesture({
    minDistance: 7,
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      const distance = Math.hypot(event.x - center, event.y - center);
      if (distance < size * 0.225 || distance > size * 0.34) {
        GestureStateManager.fail(event.handlerTag);
        return;
      }
      cancelAnimation(rotation);
      previousAngle.set(Math.atan2(event.y - center, event.x - center));
      previousSnap.set(snappedTonic(rotation.get()));
    },
    onActivate: () => {
      'worklet';
      dragging.set(true);
    },
    onUpdate: (event) => {
      'worklet';
      const angle = Math.atan2(event.y - center, event.x - center);
      rotation.set(rotation.get() + shortestAngle(angle - previousAngle.get()));
      previousAngle.set(angle);
      const step = snappedTonic(rotation.get());
      if (step !== previousSnap.get()) {
        previousSnap.set(step);
        scheduleOnRN(onSnap, step);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled) {
        const target = Math.round(rotation.get() / SEMITONE_ANGLE) * SEMITONE_ANGLE;
        rotation.set(withTiming(target, { duration: 160 }));
        scheduleOnRN(onRotate, snappedTonic(target));
      }
    },
    onFinalize: (event) => {
      'worklet';
      if (event.canceled && dragging.get()) {
        rotation.set(
          withTiming(rotation.get() + shortestAngle(tonic * SEMITONE_ANGLE - rotation.get()), {
            duration: 160,
          }),
        );
      }
      dragging.set(false);
    },
  });
  const tap = useTapGesture({
    maxDistance: 7,
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled) return;
      const pitch = pitchAtPoint(event.x, event.y, size);
      if (pitch === null) return;
      const distance = Math.hypot(event.x - center, event.y - center);
      if (distance > size * 0.34) scheduleOnRN(onSelectTonic, pitch);
      else scheduleOnRN(onPlayPitch, pitch);
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  return (
    <GestureDetector gesture={gesture} touchAction="none">
      <View style={{ width: size, height: size }} testID="chromatic-wheel">
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
          <Circle cx={center} cy={center} r={size * 0.469} color="#171B15" />
          {Array.from({ length: 60 }, (_, tick) => {
            const from = pointOnWheel(tick / 5, size * 0.484, center);
            const to = pointOnWheel(tick / 5, size * (tick % 5 === 0 ? 0.498 : 0.49), center);
            return (
              <Line
                key={tick}
                p1={vec(from.x, from.y)}
                p2={vec(to.x, to.y)}
                color={tick % 5 === 0 ? '#59624E' : '#30372A'}
                strokeWidth={tick % 5 === 0 ? 1.5 : 1}
              />
            );
          })}
          {PITCH_CLASSES.map((pitch) => (
            <Path
              key={pitch}
              path={sector(size, pitch, 0.344, 0.468)}
              color={
                pitch === tonic
                  ? '#2B3820'
                  : isInScale(pitch, tonic, scale, direction)
                    ? '#222D1B'
                    : '#141811'
              }
            />
          ))}
          <Circle
            cx={center}
            cy={center}
            r={size * 0.469}
            style="stroke"
            strokeWidth={1}
            color="#3C4533"
          />
          <Circle
            cx={center}
            cy={center}
            r={size * 0.34}
            style="stroke"
            strokeWidth={1}
            color="#38432E"
          />
          <Group origin={vec(center, center)} transform={ringTransform}>
            {PITCH_CLASSES.map((pitch) => (
              <Path
                key={pitch}
                path={sector(size, pitch, 0.229, 0.335)}
                color={
                  pitch === 0
                    ? '#D1F57A'
                    : isInScale(pitch, 0, scale, direction)
                      ? '#2C3B21'
                      : '#181E14'
                }
              />
            ))}
          </Group>
          <Circle cx={center} cy={center} r={size * 0.216} color={colors.surface}>
            <RadialGradient
              c={vec(center, center - 20)}
              r={size * 0.29}
              colors={['#2A3322', '#171D13']}
            />
          </Circle>
          <Circle
            cx={center}
            cy={center}
            r={size * 0.216}
            color="#3A462F"
            style="stroke"
            strokeWidth={1}
          />
          {PITCH_CLASSES.map((pitch) => {
            const p = pointOnWheel(pitch, size * 0.45, center);
            return pitch === tonic ||
              pitch === playingPitch ||
              (scale !== 'chromatic' && isInScale(pitch, tonic, scale, direction)) ? (
              <Circle
                key={pitch}
                cx={p.x}
                cy={p.y}
                r={pitch === playingPitch ? 3.5 : pitch === tonic ? 2.5 : 1.8}
                color={pitch === playingPitch || pitch === tonic ? colors.lime : '#8EAA68'}
              />
            ) : null;
          })}
        </Canvas>
        {PITCH_CLASSES.map((pitch) => {
          const p = pointOnWheel(pitch, size * 0.404, center);
          return (
            <View
              key={pitch}
              style={[styles.label, { left: p.x - 23, top: p.y - 22 }]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Set ${noteName(pitch, accidentals)} as tonic`}
              accessibilityHint={
                isInScale(pitch, tonic, scale, direction)
                  ? `In ${SCALES[scale].name} scale`
                  : `Outside ${SCALES[scale].name} scale`
              }
              accessibilityState={{ selected: pitch === tonic }}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'activate') onSelectTonic(pitch);
              }}
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  styles.absolute,
                  !isInScale(pitch, tonic, scale, direction) && styles.dimAbsolute,
                  { fontSize: size * 0.053 },
                  pitch === tonic && styles.selectedLabel,
                  pitch === playingPitch && styles.playingLabel,
                ]}
              >
                {noteName(pitch, accidentals)}
              </Text>
            </View>
          );
        })}
        <Animated.View style={[StyleSheet.absoluteFill, ringStyle]} pointerEvents="none">
          {PITCH_CLASSES.map((pitch) => (
            <RelativeLabel
              key={pitch}
              pitch={pitch}
              size={size}
              rotation={rotation}
              text={scaleRelativeName(pitch, notation, scale, direction, convention)}
              description={
                notation === 'sargam'
                  ? relativeDescription(pitch, notation, convention)
                  : scaleRelativeName(pitch, notation, scale, direction, convention)
              }
              inScale={isInScale(pitch, 0, scale, direction)}
              playing={playingPitch !== null && normalizePitch(playingPitch - tonic) === pitch}
              onActivate={() => onPlayPitch(normalizePitch(tonic + pitch))}
            />
          ))}
        </Animated.View>
        <View
          style={[
            styles.center,
            { left: size * 0.3, top: size * 0.3, width: size * 0.4, height: size * 0.4 },
          ]}
          pointerEvents="box-none"
        >
          <Text maxFontSizeMultiplier={1.15} style={[styles.home, { fontSize: size * 0.022 }]}>
            YOUR TONIC
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play tonic ${noteName(tonic, accidentals)}${octave}`}
            onPress={() => onPlayPitch(tonic)}
            style={styles.centerPlay}
          >
            <Text
              maxFontSizeMultiplier={1.1}
              style={[styles.centerNote, { fontSize: size * 0.115 }]}
            >
              {noteName(tonic, accidentals)}
              <Text style={{ fontSize: size * 0.039, color: colors.muted }}>{octave}</Text>
            </Text>
          </Pressable>
          <Text
            maxFontSizeMultiplier={1.1}
            style={[styles.centerRelative, { fontSize: size * 0.029 }]}
          >
            Sa · Do · 1
          </Text>
          <View style={styles.centerDash} />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    width: 46,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  absolute: { color: '#C2C9B7', fontFamily: fonts.display, textAlign: 'center' },
  dimAbsolute: { color: '#626D58' },
  selectedLabel: { color: colors.lime, fontFamily: fonts.displayBold },
  playingLabel: { color: colors.lime },
  relative: { color: '#B5C99E', fontFamily: fonts.medium, textAlign: 'center' },
  dimRelative: { color: '#5C6950' },
  tonicLabel: { color: '#1B2910', fontFamily: fonts.bold },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  home: { color: colors.muted, letterSpacing: 2.1, fontFamily: fonts.bold },
  centerPlay: { minWidth: 64, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  centerNote: { color: colors.text, fontFamily: fonts.display, letterSpacing: -2 },
  centerRelative: { color: colors.lime, fontFamily: fonts.medium },
  centerDash: { width: 18, height: 2, borderRadius: 2, marginTop: 12, backgroundColor: '#6C804F' },
});
