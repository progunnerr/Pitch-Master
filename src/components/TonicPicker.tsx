import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { noteName, PITCH_CLASSES, type Accidentals } from '../domain/musicTheory';
import { colors, fonts } from '../theme/theme';
import { Eyebrow, IconButton } from './Controls';

export function TonicPicker({
  visible,
  tonic,
  accidentals,
  onSelect,
  onClose,
}: {
  visible: boolean;
  tonic: number;
  accidentals: Accidentals;
  onSelect: (tonic: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss tonic picker"
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.top}>
            <Eyebrow>CHOOSE YOUR TONIC</Eyebrow>
            <IconButton icon="x" label="Close tonic picker" onPress={onClose} />
          </View>
          <Text style={styles.title}>Where is home?</Text>
          <Text style={styles.description}>Every note can be your Sa, Do, or 1.</Text>
          <View style={styles.grid}>
            {PITCH_CLASSES.map((pitch) => (
              <Pressable
                key={pitch}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${noteName(pitch, accidentals)}`}
                accessibilityState={{ selected: pitch === tonic }}
                onPress={() => {
                  onSelect(pitch);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.note,
                  pitch === tonic && styles.selected,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.noteText, pitch === tonic && { color: colors.background }]}>
                  {noteName(pitch, accidentals)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000B8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 30, marginTop: 14 },
  description: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 21,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  note: {
    width: '22%',
    flexGrow: 1,
    height: 60,
    borderRadius: 13,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.lime, borderColor: colors.lime },
  noteText: { color: colors.text, fontFamily: fonts.display, fontSize: 21 },
});
