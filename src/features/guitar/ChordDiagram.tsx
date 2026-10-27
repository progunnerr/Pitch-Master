import { Text, View } from 'react-native';
import { colors } from '../../theme/theme';
import type { Finger, GuitarChord } from './model';
import { Choices, NumberField, s } from './StudioShared';

export function ChordDiagram({ chord, active = false }: { chord: GuitarChord; active?: boolean }) {
  const frets = chord.strings.flatMap((v) => (v.fret && v.fret > 0 ? [v.fret] : []));
  const start = Math.max(...frets, 0) > 4 ? Math.max(1, Math.min(...frets)) : 1;
  const rows = Math.max(4, Math.max(...frets, 0) - start + 1);
  const description = chord.strings
    .map(
      (v) =>
        `String ${v.string}: ${v.fret === null ? 'muted' : v.fret === 0 ? 'open' : `fret ${v.fret}, finger ${v.finger ?? 'unspecified'}`}`,
    )
    .join('. ');
  return (
    <View
      style={[s.card, { flexGrow: 1, minWidth: 220, alignItems: 'center' }, active && s.selected]}
      accessibilityLabel={`${chord.name}. ${description}`}
    >
      <Text style={[s.cardTitle, active && s.lime]}>
        {chord.id === 'D' && chord.strings[0]?.fret === 2 ? 'D / F♯' : chord.name}
      </Text>
      <Text style={s.caption}>6 · E → 1 · e {start > 1 ? ` · fret ${start}` : ''}</Text>
      <View style={{ width: 190, height: rows * 34 + 36, marginHorizontal: 12 }}>
        {Array.from({ length: rows + 1 }, (_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: 30 + i * 34,
              left: 10,
              width: 170,
              height: i === 0 && start === 1 ? 4 : 1,
              backgroundColor: colors.muted,
            }}
          />
        ))}
        {chord.strings.map((v, i) => (
          <View
            key={v.string}
            style={{
              position: 'absolute',
              left: 10 + i * 34,
              top: 0,
              width: 1,
              alignItems: 'center',
            }}
          >
            <Text style={[s.caption, { width: 28, textAlign: 'center', height: 27 }]}>
              {v.fret === null ? '×' : v.fret === 0 ? '○' : ''}
            </Text>
            <View
              style={{ width: 1, height: rows * 34, backgroundColor: colors.muted, marginTop: 3 }}
            />
            {v.fret !== null && v.fret > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 30 + (v.fret - start + 0.5) * 34 - 12,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.lime,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.background, fontWeight: '700', fontSize: 13 }}>
                  {v.finger ?? '•'}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
      <Text style={[s.caption, s.center]}>1 index · 2 middle · 3 ring · 4 pinky · T thumb</Text>
    </View>
  );
}
export function ChordEditor({
  chord,
  onChange,
}: {
  chord: GuitarChord;
  onChange: (c: GuitarChord) => void;
}) {
  return (
    <View style={s.section}>
      {chord.strings.map((string) => (
        <View key={string.string} style={s.card}>
          <Text style={s.badge}>STRING {string.string}</Text>
          <Choices
            label={`String ${string.string} sound`}
            value={string.fret === null ? 'muted' : string.fret === 0 ? 'open' : 'fretted'}
            options={[
              { value: 'muted', label: 'Muted ×' },
              { value: 'open', label: 'Open ○' },
              { value: 'fretted', label: 'Fretted' },
            ]}
            onChange={(v) =>
              onChange({
                ...chord,
                strings: chord.strings.map((s) =>
                  s.string === string.string
                    ? {
                        ...s,
                        fret: v === 'muted' ? null : v === 'open' ? 0 : 2,
                        finger: v === 'fretted' ? '1' : null,
                      }
                    : s,
                ),
              })
            }
          />
          {string.fret !== null && string.fret > 0 && (
            <>
              <NumberField
                label={`String ${string.string} fret`}
                value={string.fret}
                min={1}
                max={12}
                onChange={(fret) =>
                  onChange({
                    ...chord,
                    strings: chord.strings.map((s) =>
                      s.string === string.string ? { ...s, fret: Math.round(fret) } : s,
                    ),
                  })
                }
              />
              <Choices
                label={`String ${string.string} finger`}
                value={string.finger ?? ''}
                options={['1', '2', '3', '4', 'T', ''].map((value) => ({
                  value,
                  label: value || 'None',
                }))}
                onChange={(v) =>
                  onChange({
                    ...chord,
                    strings: chord.strings.map((s) =>
                      s.string === string.string ? { ...s, finger: (v || null) as Finger } : s,
                    ),
                  })
                }
              />
            </>
          )}
        </View>
      ))}
    </View>
  );
}
