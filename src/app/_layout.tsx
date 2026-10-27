import { Stack } from 'expo-router';
import AppProviders from '../../App';
import { PracticeProgressProvider } from '../features/practice/PracticeProgressProvider';
import { colors } from '../theme/theme';
import { PreferencesProvider } from '../features/settings/usePreferences';
import { StudioProvider } from '../features/guitar/StudioProvider';
import { View } from 'react-native';
import { MainNavigation } from '../components/MainNavigation';

export default function RootLayout() {
  return (
    <AppProviders>
      <PreferencesProvider>
        <PracticeProgressProvider>
          <StudioProvider>
            <View style={{ flex: 1 }}>
              <View style={{ flex: 1 }}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                  }}
                />
              </View>
              <MainNavigation />
            </View>
          </StudioProvider>
        </PracticeProgressProvider>
      </PreferencesProvider>
    </AppProviders>
  );
}
