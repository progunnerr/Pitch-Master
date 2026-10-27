import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { IconButton, Segmented } from '../../components/Controls';
import { colors, fonts } from '../../theme/theme';
import type { Preferences } from './preferences';

function Stepper({
  label,
  value,
  suffix,
  onMinus,
  onPlus,
  min,
  max,
}: {
  label: string;
  value: number;
  suffix?: string;
  onMinus: () => void;
  onPlus: () => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <IconButton
          icon="minus"
          label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onPress={onMinus}
        />
        <Text style={styles.value}>
          {value}
          {suffix}
        </Text>
        <IconButton
          icon="plus"
          label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onPress={onPlus}
        />
      </View>
    </View>
  );
}

export function SettingsPanel({
  preferences: p,
  update,
  expanded,
  onToggle,
}: {
  preferences: Preferences;
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.heading}
      >
        <View style={styles.headingLabel}>
          <Feather name="sliders" size={16} color={colors.muted} />
          <Text style={styles.headingText}>Make it yours</Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.muted} />
      </Pressable>
      {expanded && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>SARGAM LANGUAGE</Text>
          <Segmented
            label="Sargam language"
            value={p.sargamLanguage}
            onChange={(value) => update('sargamLanguage', value)}
            options={[
              { value: 'english', label: 'English · Sa Re Ga' },
              { value: 'hindi', label: 'हिन्दी · सा रे गा' },
            ]}
          />
          <Text style={styles.sectionTitle}>NOTE SPELLING</Text>
          <Segmented
            label="Absolute note accidentals"
            value={p.accidentals}
            onChange={(value) => update('accidentals', value)}
            options={[
              { value: 'sharps', label: 'Sharps  ♯' },
              { value: 'flats', label: 'Flats  ♭' },
            ]}
          />
          <Text style={styles.sectionTitle}>CHROMATIC SOLFÈGE</Text>
          <Segmented
            label="Chromatic solfège convention"
            value={p.solfegeConvention}
            onChange={(value) => update('solfegeConvention', value)}
            options={[
              { value: 'sharps', label: 'Raised · Di, Ri' },
              { value: 'flats', label: 'Lowered · Ra, Me' },
            ]}
          />
          <Stepper
            label="Octave"
            value={p.octave}
            min={3}
            max={5}
            onMinus={() => update('octave', p.octave - 1)}
            onPlus={() => update('octave', p.octave + 1)}
          />
          <Stepper
            label="Tempo"
            value={p.tempo}
            suffix=" bpm"
            min={40}
            max={200}
            onMinus={() => update('tempo', Math.max(40, p.tempo - 10))}
            onPlus={() => update('tempo', Math.min(200, p.tempo + 10))}
          />
          <Stepper
            label="Volume"
            value={Math.round(p.volume * 100)}
            suffix="%"
            min={0}
            max={100}
            onMinus={() => update('volume', Math.max(0, Math.round((p.volume - 0.1) * 100) / 100))}
            onPlus={() => update('volume', Math.min(1, Math.round((p.volume + 0.1) * 100) / 100))}
          />
          <View style={styles.settingRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Haptic feedback</Text>
              <Text style={styles.hint}>A little nudge at every note</Text>
            </View>
            <Switch
              accessibilityLabel="Haptic feedback"
              value={p.haptics}
              onValueChange={(value) => update('haptics', value)}
              trackColor={{ false: '#3D4535', true: '#637B43' }}
              thumbColor={p.haptics ? colors.lime : '#A3AA99'}
            />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Sound while rotating</Text>
              <Text style={styles.hint}>Hear each new tonic as you turn</Text>
            </View>
            <Switch
              accessibilityLabel="Sound while rotating"
              value={p.soundOnRotate}
              onValueChange={(value) => update('soundOnRotate', value)}
              trackColor={{ false: '#3D4535', true: '#637B43' }}
              thumbColor={p.soundOnRotate ? colors.lime : '#A3AA99'}
            />
          </View>
          <Text style={styles.footnote}>
            Equal temperament · A4 = 440 Hz{'\n'}Saved automatically on this device.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, borderColor: colors.line },
  heading: {
    minHeight: 58,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  sectionTitle: {
    fontFamily: fonts.bold,
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 1.7,
    marginTop: 8,
  },
  settingRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: {
    minWidth: 58,
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  switchLabel: { flex: 1, gap: 4 },
  hint: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 15, color: colors.muted },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
