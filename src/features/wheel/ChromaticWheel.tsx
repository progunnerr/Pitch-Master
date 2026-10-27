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
  relativeName,
  scaleRelativeName,
  isInScale,
  SCALES,
  type ScaleId,
  type Direction,
  type Accidentals,
  type Notation,
  type SargamLanguage,
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
  sargamLanguage: SargamLanguage;
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

function WheelLabel({
  pitch,
  size,
  ring,
  rotation,
  text,
  description,
  hint,
  inScale,
  playing,
  selected,
  onActivate,
}: {
  pitch: number;
  size: number;
  ring: 'inner' | 'outer';
  rotation: Pick<SharedValue<number>, 'get'>;
  text: string;
  description: string;
  hint: string;
  inScale: boolean;
  playing: boolean;
  selected: boolean;
  onActivate: () => void;
}) {
  const outer = ring === 'outer';
  const point = pointOnWheel(pitch, size * (outer ? 0.404 : 0.285), size / 2);
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-rotation.get()}rad` }] }));
  return (
    <View
      style={[styles.label, { left: point.x - 23, top: point.y - 22 }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={description}
      accessibilityHint={hint}
      accessibilityState={outer ? { selected } : undefined}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') onActivate();
      }}
    >
      <Animated.Text
        maxFontSizeMultiplier={outer ? 1.3 : 1.25}
        style={[
          outer ? styles.absolute : styles.relative,
          !inScale && (outer ? styles.dimAbsolute : styles.dimRelative),
          { fontSize: size * (outer ? 0.053 : 0.043) },
          outer && selected && styles.selectedLabel,
          playing && styles.playingLabel,
          !outer && selected && styles.tonicLabel,
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
  sargamLanguage,
  playingPitch,
  scale,
  direction,
  onSelectTonic,
  onPlayPitch,
  onRotate,
  onSnap,
}: WheelProps) {
  const center = size / 2;
  // The tonic is the angle between the rings; either ring can change that interval.
  const rotation = useSharedValue(tonic * SEMITONE_ANGLE);
  const outerRotation = useSharedValue(0);
  const outerAnchor = useSharedValue(0);
  const targetTonic = useSharedValue(tonic);
  const previousAngle = useSharedValue(0);
  const previousSnap = useSharedValue(tonic);
  const dragging = useSharedValue(false);
  const draggingOuter = useSharedValue(false);
  const innerRotation = useDerivedValue(() => outerRotation.get() + rotation.get());
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRotation.get()}rad` }],
  }));
  const ringTransform = useDerivedValue(() => [{ rotate: innerRotation.get() }]);
  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRotation.get()}rad` }],
  }));
  const outerRingTransform = useDerivedValue(() => [{ rotate: outerRotation.get() }]);

  useEffect(() => {
    // A completed drag already scheduled both rings to settle together.
    if (targetTonic.get() === tonic) return;
    targetTonic.set(tonic);
    const target = rotation.get() + shortestAngle(tonic * SEMITONE_ANGLE - rotation.get());
    rotation.set(withTiming(target, { duration: 240 }));
  }, [tonic, rotation, targetTonic]);

  const pan = usePanGesture({
    minDistance: 7,
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      const distance = Math.hypot(event.x - center, event.y - center);
      if (distance < size * 0.225 || distance > size * 0.48) {
        GestureStateManager.fail(event.handlerTag);
        return;
      }
      draggingOuter.set(distance > size * 0.34);
      previousAngle.set(Math.atan2(event.y - center, event.x - center));
    },
    onActivate: () => {
      'worklet';
      cancelAnimation(rotation);
      cancelAnimation(outerRotation);
      // Finish an interrupted snap before starting the next independent rotation.
      outerRotation.set(outerAnchor.get());
      rotation.set(
        rotation.get() + shortestAngle(targetTonic.get() * SEMITONE_ANGLE - rotation.get()),
      );
      previousSnap.set(targetTonic.get());
      dragging.set(true);
    },
    onUpdate: (event) => {
      'worklet';
      const angle = Math.atan2(event.y - center, event.x - center);
      const delta = shortestAngle(angle - previousAngle.get());
      if (draggingOuter.get()) {
        outerRotation.set(outerRotation.get() + delta);
        rotation.set(rotation.get() - delta);
      } else {
        rotation.set(rotation.get() + delta);
      }
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
        if (draggingOuter.get()) {
          // Equal and opposite snap animations keep the inner ring in place.
          const outerTarget = outerRotation.get() + rotation.get() - target;
          outerAnchor.set(outerTarget);
          outerRotation.set(withTiming(outerTarget, { duration: 160 }));
        }
        targetTonic.set(snappedTonic(target));
        rotation.set(withTiming(target, { duration: 160 }));
        scheduleOnRN(onRotate, snappedTonic(target));
      }
    },
    onFinalize: (event) => {
      'worklet';
      if (event.canceled && dragging.get()) {
        outerRotation.set(
          withTiming(outerRotation.get() + shortestAngle(outerAnchor.get() - outerRotation.get()), {
            duration: 160,
          }),
        );
        rotation.set(
          withTiming(
            rotation.get() + shortestAngle(targetTonic.get() * SEMITONE_ANGLE - rotation.get()),
            { duration: 160 },
          ),
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
      const pitch = pitchAtPoint(event.x, event.y, size, outerRotation.get());
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
          <Group origin={vec(center, center)} transform={outerRingTransform}>
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
          </Group>
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
        </Canvas>
        <Animated.View
          style={[StyleSheet.absoluteFill, outerRingStyle]}
          pointerEvents="box-none"
          testID="outer-ring"
        >
          {PITCH_CLASSES.map((pitch) => (
            <WheelLabel
              key={pitch}
              pitch={pitch}
              size={size}
              ring="outer"
              rotation={outerRotation}
              text={noteName(pitch, accidentals)}
              description={`Set ${noteName(pitch, accidentals)} as tonic`}
              hint={
                isInScale(pitch, tonic, scale, direction)
                  ? `In ${SCALES[scale].name} scale`
                  : `Outside ${SCALES[scale].name} scale`
              }
              inScale={isInScale(pitch, tonic, scale, direction)}
              selected={pitch === tonic}
              playing={pitch === playingPitch}
              onActivate={() => onSelectTonic(pitch)}
            />
          ))}
        </Animated.View>
        <Animated.View
          style={[StyleSheet.absoluteFill, ringStyle]}
          pointerEvents="none"
          testID="inner-ring"
        >
          {PITCH_CLASSES.map((pitch) => (
            <WheelLabel
              key={pitch}
              pitch={pitch}
              size={size}
              ring="inner"
              rotation={innerRotation}
              text={scaleRelativeName(
                pitch,
                notation,
                scale,
                direction,
                convention,
                sargamLanguage,
              )}
              description={
                notation === 'sargam'
                  ? relativeDescription(pitch, notation, convention, sargamLanguage)
                  : scaleRelativeName(pitch, notation, scale, direction, convention, sargamLanguage)
              }
              hint="Play this relative pitch"
              inScale={isInScale(pitch, 0, scale, direction)}
              selected={pitch === 0}
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
            {relativeName(0, 'sargam', convention, sargamLanguage)} · Do · 1
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
