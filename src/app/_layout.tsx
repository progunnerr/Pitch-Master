import { Stack } from 'expo-router';
import AppProviders from '../../App';
import { PracticeProgressProvider } from '../features/practice/PracticeProgressProvider';
import { colors } from '../theme/theme';
import { PreferencesProvider } from '../features/settings/usePreferences';

export default function RootLayout() {
  return (
    <AppProviders>
      <PreferencesProvider>
        <PracticeProgressProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </PracticeProgressProvider>
      </PreferencesProvider>
    </AppProviders>
  );
}
