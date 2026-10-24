import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { ActionButton, IconButton } from '../../components/Controls';
import { usePracticeProgress } from './PracticeProgressProvider';
import { styles } from './practiceStyles';

export function PracticeHeader({ exercise = false }: { exercise?: boolean }) {
  return (
    <View style={styles.header}>
      <IconButton
        icon="arrow-left"
        label={exercise ? 'Back to practice' : 'Back to explorer'}
        onPress={() => router.dismissTo(exercise ? '/practice' : '/')}
      />
      <Text style={styles.headerLabel}>
        pitch master<Text style={styles.lime}>. practice</Text>
      </Text>
    </View>
  );
}

export function ProgressStatus() {
  const { ready, error, retry } = usePracticeProgress();
  if (!error && ready) return null;
  return (
    <View style={styles.card} accessibilityRole={error ? 'alert' : undefined}>
      <Text style={[styles.body, error && styles.error]}>
        {error ?? 'Loading your practice progress…'}
      </Text>
      {error && (
        <ActionButton
          icon="refresh-cw"
          label={ready ? 'Retry saving' : 'Retry loading'}
          onPress={retry}
        />
      )}
    </View>
  );
}
