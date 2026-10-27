import Feather from '@expo/vector-icons/Feather';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudio } from '../features/guitar/StudioProvider';
import { DESTINATIONS, primaryDestination } from '../navigation/destinations';
import { colors, fonts } from '../theme/theme';

export function MainNavigation() {
  const pathname = usePathname();
  const { data, ready } = useStudio();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const selected = primaryDestination(pathname);
  if (!selected || keyboardOpen) return null;
  const active = ready
    ? data.sessions.find((session) => session.id === data.activeId && session.phase !== 'finished')
    : undefined;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      {active && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Continue practice: ${active.routine.name}`}
          onPress={() =>
            router.navigate({ pathname: '/guitar/session', params: { id: active.id } })
          }
          style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
        >
          <Feather name="play-circle" size={22} color={colors.lime} />
          <View style={styles.resumeText}>
            <Text style={styles.resumeLabel}>CONTINUE PRACTICE</Text>
            <Text numberOfLines={1} style={styles.resumeName}>
              {active.routine.name}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.lime} />
        </Pressable>
      )}
      <View accessibilityLabel="Main navigation" style={styles.row}>
        {DESTINATIONS.map((destination) => {
          const activeTab = selected.href === destination.href;
          return (
            <Pressable
              key={destination.href}
              accessibilityRole="tab"
              accessibilityLabel={destination.title}
              accessibilityState={{ selected: activeTab }}
              onPress={() => {
                if (!activeTab) router.navigate(destination.href);
              }}
              style={({ pressed }) => [
                styles.item,
                activeTab && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <Feather
                name={destination.icon}
                size={20}
                color={activeTab ? colors.lime : colors.muted}
              />
              <Text style={[styles.label, activeTab && styles.activeLabel]}>
                {destination.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line },
  row: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 4,
    paddingTop: 5,
    paddingBottom: 6,
    gap: 2,
  },
  item: {
    flex: 1,
    minWidth: 44,
    minHeight: 58,
    paddingHorizontal: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  selected: { backgroundColor: colors.limeDark },
  label: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10, textAlign: 'center' },
  activeLabel: { color: colors.lime },
  pressed: { opacity: 0.7 },
  resume: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  resumeText: { flex: 1, gap: 3 },
  resumeLabel: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, color: colors.lime },
  resumeName: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
});
