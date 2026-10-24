import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';
import { colors, fonts } from '../theme/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  selected = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        selected && styles.selectedIcon,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Feather name={icon} size={19} color={selected ? colors.lime : colors.text} />
    </Pressable>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  primary = false,
  style,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  primary?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.primary,
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Feather name={icon} size={17} color={primary ? colors.background : colors.text} />
      <Text style={[styles.actionLabel, primary && { color: colors.background }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View style={styles.segmented} accessibilityLabel={label}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => [
            styles.segment,
            value === option.value && styles.activeSegment,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.segmentLabel, value === option.value && styles.activeSegmentLabel]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

const styles = StyleSheet.create({
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  selectedIcon: { backgroundColor: colors.limeDark, borderColor: '#5A703A' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  action: {
    minHeight: 50,
    minWidth: 0,
    maxWidth: '100%',
    flexShrink: 1,
    borderRadius: 13,
    backgroundColor: colors.elevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  primary: { backgroundColor: colors.lime, borderColor: colors.lime },
  actionLabel: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#151812',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  activeSegment: { backgroundColor: '#323D27' },
  segmentLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  activeSegmentLabel: { color: colors.lime },
  eyebrow: { color: colors.muted, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.9 },
});
