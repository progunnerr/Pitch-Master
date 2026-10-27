import { Text, View } from 'react-native';
import { ActionButton, IconButton } from '../../components/Controls';
import type { ChordStep } from './model';
import { Choices, NumberField, s } from './StudioShared';

export function ProgressionEditor({
  value,
  onChange,
}: {
  value: ChordStep[];
  onChange: (v: ChordStep[]) => void;
}) {
  return (
    <View style={s.section}>
      <Text style={s.caption}>Chord progression · loops in order</Text>
      {value.map((step, i) => (
        <View key={i} style={s.card}>
          <Choices
            label={`Step ${i + 1} chord`}
            options={[
              { value: 'G', label: 'G major' },
              { value: 'D', label: 'D major' },
            ]}
            value={step.chordId}
            onChange={(chordId) => onChange(value.map((v, j) => (j === i ? { ...v, chordId } : v)))}
          />
          <View style={s.row}>
            <NumberField
              label={`Step ${i + 1} bars`}
              value={step.bars}
              min={1}
              max={16}
              onChange={(bars) =>
                onChange(value.map((v, j) => (j === i ? { ...v, bars: Math.round(bars) } : v)))
              }
            />
            <IconButton
              icon="trash-2"
              label={`Remove progression step ${i + 1}`}
              disabled={value.length === 1}
              onPress={() => onChange(value.filter((_, j) => i !== j))}
            />
          </View>
        </View>
      ))}
      <ActionButton
        icon="plus"
        label="Add chord step"
        disabled={value.length >= 16}
        onPress={() => onChange([...value, { chordId: 'G', bars: 1 }])}
      />
    </View>
  );
}
