import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, IconButton } from '../../components/Controls';
import { colors, fonts } from '../../theme/theme';
import { styles as practiceStyles } from '../practice/practiceStyles';
import { useStudio } from './StudioProvider';
import { primaryDestination } from '../../navigation/destinations';

export const s = StyleSheet.create({
  ...practiceStyles,
  page: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 22,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    lineHeight: 40,
    color: colors.text,
    letterSpacing: -1,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  field: { gap: 6, flexGrow: 1, minWidth: 100 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.elevated,
  },
  selected: { borderColor: colors.lime, backgroundColor: colors.limeDark },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  line: { height: 1, backgroundColor: colors.line },
  timer: {
    fontFamily: fonts.displayBold,
    fontSize: 76,
    color: colors.lime,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    letterSpacing: -3,
  },
  center: { textAlign: 'center' },
  track: { height: 5, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.lime, borderRadius: 3 },
  tile: {
    width: 49,
    minHeight: 66,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.background,
  },
  symbol: { color: colors.text, fontSize: 30, lineHeight: 36, fontFamily: fonts.displayBold },
  warning: { borderWidth: 1, borderColor: '#724A3B', borderRadius: 14, padding: 16, gap: 12 },
});
export function StudioPage({
  title,
  children,
  home = false,
}: {
  title: string;
  children: ReactNode;
  home?: boolean;
}) {
  const { ready, error, retry } = useStudio();
  const showNavigation = !!primaryDestination(usePathname());
  return (
    <SafeAreaView style={s.safe} edges={showNavigation ? ['top', 'left', 'right'] : undefined}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
      >
        <View style={s.header}>
          <IconButton
            icon="arrow-left"
            label={home ? 'Back to explorer' : 'Back to routines'}
            onPress={() => router.dismissTo(home ? '/' : '/guitar/routines')}
          />
          <Text style={s.headerLabel}>
            pitch master<Text style={s.lime}>. guitar</Text>
          </Text>
        </View>
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        {error && (
          <View style={s.warning} accessibilityRole="alert">
            <Text style={[s.body, s.error]}>{error}</Text>
            <ActionButton
              label={ready ? 'Retry saving' : 'Retry loading'}
              icon="refresh-cw"
              onPress={retry}
            />
          </View>
        )}
        {!ready ? <ActivityIndicator color={colors.lime} /> : children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.caption}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        maxLength={120}
      />
    </View>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 10000,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);
  return (
    <View style={s.field}>
      <Text style={s.caption}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        style={s.input}
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChangeText={(v) => {
          if (!/^\d*\.?\d*$/.test(v)) return;
          setDraft(v);
          onChange(v === '' ? 0 : Number(v));
        }}
        onBlur={() => {
          focused.current = false;
          const next = Math.max(min, Math.min(max, Number(draft) || 0));
          setDraft(String(next));
          onChange(next);
        }}
      />
    </View>
  );
}
export function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.section}>
      <Text style={s.caption}>{label}</Text>
      <View style={s.row}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${o.label}`}
            accessibilityState={{ selected: value === o.value }}
            onPress={() => onChange(o.value)}
            style={[s.chip, value === o.value && s.selected]}
          >
            <Text style={[s.chipText, value === o.value && s.lime]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.between}>
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: '#546B33' }}
        thumbColor={value ? colors.lime : colors.muted}
      />
    </View>
  );
}
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.section}>
      <Text style={s.caption}>{label}</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        style={s.track}
      >
        <View style={[s.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
      </View>
    </View>
  );
}
