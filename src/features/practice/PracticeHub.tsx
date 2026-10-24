import { router } from 'expo-router';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Eyebrow } from '../../components/Controls';
import { PRACTICE_KINDS, PRACTICE_MODES } from './exercises';
import { usePracticeProgress } from './PracticeProgressProvider';
import { PracticeHeader, ProgressStatus } from './PracticeShared';
import { progressTotals } from './progress';
import { styles } from './practiceStyles';

export default function PracticeHub() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { progress, ready } = usePracticeProgress();
  const totals = progressTotals(progress);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <PracticeHeader />
        <View style={styles.section}>
          <Eyebrow>TRAIN YOUR EAR, ONE RELATIONSHIP AT A TIME</Eyebrow>
          <Text accessibilityRole="header" style={styles.title}>
            Make listening a habit.
          </Text>
          <Text style={styles.subtitle}>
            Short, untimed rounds. Listen, compare, and try again. Every key has a place to begin.
          </Text>
        </View>
        <ProgressStatus />
        {ready && (
          <View style={[styles.card, styles.stats]}>
            {[
              ['Rounds completed', totals.completed],
              ['Unaided first-try wins', totals.firstTryCorrect],
              ['Best streak in a mode', totals.bestStreak],
            ].map(([label, value]) => (
              <View style={styles.stat} key={label}>
                <Text style={styles.statNumber}>{value}</Text>
                <Text style={styles.caption}>{label}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.grid}>
          {PRACTICE_KINDS.map((kind, index) => {
            const mode = PRACTICE_MODES[kind];
            const stats = progress.modes[kind];
            return (
              <View style={[styles.card, styles.mode, wide && styles.wideMode]} key={kind}>
                <Eyebrow>{`0${index + 1} / BEGINNER PRACTICE`}</Eyebrow>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  {mode.title}
                </Text>
                <Text style={styles.subtitle}>{mode.description}</Text>
                <Text style={styles.caption}>
                  {stats.completed} completed · {stats.firstTryCorrect} unaided wins · best streak{' '}
                  {stats.bestStreak}
                </Text>
                <ActionButton
                  primary
                  icon="headphones"
                  label={`Practice ${mode.title}`}
                  disabled={!ready}
                  onPress={() =>
                    router.push({ pathname: '/practice/[mode]', params: { mode: kind } })
                  }
                />
              </View>
            );
          })}
        </View>
        <Text style={styles.caption}>
          Progress is saved on this device. Replays are always welcome. Hints, guided ladders,
          retries, and revealed answers count as learning rounds; unaided first-try wins build your
          streak.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
