import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Eyebrow, IconButton } from '../../components/Controls';
import {
  SCALES,
  scaleDegrees,
  scaleIntervals,
  scaleRelativeName,
  scaleSteps,
  type Accidentals,
  type Direction,
  type ScaleId,
} from '../../domain/musicTheory';
import { colors, fonts } from '../../theme/theme';

export function ScaleSelector({
  scale,
  onChange,
}: {
  scale: ScaleId;
  onChange: (scale: ScaleId) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose scale, currently ${SCALES[scale].name}`}
        onPress={() => setOpen(true)}
        style={styles.selector}
      >
        <View style={styles.selectorLabel}>
          <Feather name="layers" size={15} color={colors.lime} />
          <Text style={styles.selectorName}>{SCALES[scale].name}</Text>
        </View>
        <View style={styles.selectorLabel}>
          <Text style={styles.count}>{SCALES[scale].ascending.length} notes</Text>
          <Feather name="chevron-down" size={16} color={colors.muted} />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Dismiss scale picker"
            onPress={() => setOpen(false)}
          />
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.pickerHeader}>
              <Eyebrow>CHOOSE A SCALE</Eyebrow>
              <IconButton icon="x" label="Close scale picker" onPress={() => setOpen(false)} />
            </View>
            <ScrollView style={styles.scaleList}>
              {(Object.keys(SCALES) as ScaleId[]).map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${SCALES[id].name} scale`}
                  accessibilityState={{ selected: id === scale }}
                  onPress={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    id === scale && styles.activeOption,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.optionName, id === scale && { color: colors.lime }]}>
                    {SCALES[id].name}
                  </Text>
                  {id === scale ? (
                    <Feather name="check" size={18} color={colors.lime} />
                  ) : (
                    <Text style={styles.count}>{SCALES[id].ascending.length} notes</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function ScaleFormula({
  scale,
  direction,
  convention,
}: {
  scale: ScaleId;
  direction: Direction;
  convention: Accidentals;
}) {
  const intervals = [...scaleIntervals(scale, direction), 12];
  const degrees = [...scaleDegrees(scale, direction), '8'];
  if (direction === 'descending') {
    intervals.reverse();
    degrees.reverse();
  }
  const western = intervals
    .map((interval) => scaleRelativeName(interval, 'solfege', scale, direction, convention))
    .join(' · ');
  const sargam = intervals
    .map((interval) => scaleRelativeName(interval, 'sargam', scale, direction, convention))
    .join(' · ');
  return (
    <View style={styles.formulaCard} testID="scale-formula">
      <View style={styles.formulaHeader}>
        <Eyebrow>INTERVAL FORMULA</Eyebrow>
        <Text style={styles.direction}>
          {direction === 'ascending' ? 'Ascending ↑' : 'Descending ↓'}
        </Text>
      </View>
      <Text style={styles.formula}>{degrees.join(' · ')}</Text>
      <Text style={styles.steps}>Semitone steps: {scaleSteps(scale, direction).join(' – ')}</Text>
      <View style={styles.translations}>
        <Text style={styles.translation}>
          <Text style={styles.translationLabel}>Solfège </Text>
          {western}
        </Text>
        <Text style={styles.translation}>
          <Text style={styles.translationLabel}>Sargam </Text>
          {sargam}
        </Text>
      </View>
      {scale === 'melodicMinor' && (
        <Text style={styles.hint}>
          Classical melodic minor raises 6 and 7 going up, and lowers them coming down.
        </Text>
      )}
      {scale !== 'chromatic' && (
        <Text style={styles.hint}>
          Solfège follows the scale’s interval spelling. Dimmed notes remain playable.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  selector: {
    width: '100%',
    maxWidth: 390,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    marginBottom: 18,
  },
  selectorLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectorName: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  count: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  backdrop: {
    flex: 1,
    backgroundColor: '#000000B8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scaleList: { flexGrow: 0, flexShrink: 1 },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 11,
    marginBottom: 4,
  },
  activeOption: { backgroundColor: colors.limeDark },
  optionName: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  formulaCard: {
    width: '100%',
    maxWidth: 530,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 20,
    marginTop: 24,
  },
  formulaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  direction: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10 },
  formula: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 30,
    color: colors.lime,
    marginTop: 14,
  },
  steps: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 6,
  },
  translations: {
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 12,
    marginTop: 14,
    gap: 8,
  },
  translation: { color: colors.text, fontFamily: fonts.regular, fontSize: 12, lineHeight: 20 },
  translationLabel: { color: colors.muted, fontFamily: fonts.medium },
  hint: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 10,
  },
});
