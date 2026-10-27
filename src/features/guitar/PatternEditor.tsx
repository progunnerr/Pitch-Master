import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActionButton, IconButton } from '../../components/Controls';
import { ACTIONS, patternTimeline, uid, type StrumAction, type StrumPattern } from './model';
import { Choices, Field, NumberField, s } from './StudioShared';
import { beatCount } from './metronome';

export function PatternStrip({
  pattern,
  beat = -1,
  subdivision = pattern.subdivision,
}: {
  pattern: StrumPattern;
  beat?: number;
  subdivision?: number;
}) {
  const length = pattern.beatsPerBar * pattern.bars;
  const position = beat < 0 ? -1 : beat % length;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewport, setViewport] = useState(280);
  const timeline = patternTimeline(pattern, subdivision);
  const activeIndex =
    position < 0 ? -1 : timeline.findIndex((step) => position >= step.beat && position < step.end);
  useEffect(() => {
    if (activeIndex >= 0)
      scroll.current?.scrollTo({
        x: Math.max(0, activeIndex * 56 - viewport / 2 + 24),
        animated: true,
      });
  }, [activeIndex, viewport]);
  return (
    <View style={s.section}>
      <Text style={s.caption}>
        {pattern.beatsPerBar} beats / bar · {pattern.bars} {pattern.bars === 1 ? 'bar' : 'bars'} ·{' '}
        {subdivision === 1
          ? 'quarter'
          : subdivision === 2
            ? 'eighth'
            : subdivision === 3
              ? 'triplet'
              : 'sixteenth'}{' '}
        note counting
      </Text>
      <ScrollView
        ref={scroll}
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ gap: 7, paddingBottom: 8 }}
      >
        {timeline.map(({ beat: start, events, counted }, i) => {
          const active = i === activeIndex;
          return (
            <View
              key={i}
              style={[s.tile, active && s.selected]}
              accessibilityLabel={`${counted ? beatCount(start, pattern.beatsPerBar) : 'Between counts'}: ${events.map((e) => ACTIONS[e.action].label).join(', ') || 'empty'}`}
            >
              <Text style={[s.symbol, active && s.lime]}>
                {events.map((e) => ACTIONS[e.action].symbol).join('') || '·'}
              </Text>
              <Text style={s.caption}>{counted ? beatCount(start, pattern.beatsPerBar) : ''}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
export function PatternEditor({
  pattern,
  onChange,
}: {
  pattern: StrumPattern;
  onChange: (p: StrumPattern) => void;
}) {
  const [brush, setBrush] = useState<StrumAction | 'erase'>('down');
  const setLength = (beatsPerBar: number, bars: number) =>
    onChange({
      ...pattern,
      beatsPerBar,
      bars,
      events: pattern.events.filter((e) => e.beat < beatsPerBar * bars),
    });
  return (
    <View style={s.section}>
      <Field
        label="Pattern name"
        value={pattern.name}
        onChange={(name) => onChange({ ...pattern, name })}
      />
      <Choices
        label="Beats per bar"
        value={String(pattern.beatsPerBar)}
        options={[2, 3, 4, 6].map((n) => ({ value: String(n), label: String(n) }))}
        onChange={(v) => setLength(Number(v), pattern.bars)}
      />
      <Choices
        label="Pattern length"
        value={String(pattern.bars)}
        options={[1, 2, 4].map((n) => ({
          value: String(n),
          label: `${n} ${n === 1 ? 'bar' : 'bars'}`,
        }))}
        onChange={(v) => setLength(pattern.beatsPerBar, Number(v))}
      />
      <Choices
        label="Beat subdivision"
        value={String(pattern.subdivision)}
        options={[
          { value: '1', label: 'Quarter' },
          { value: '2', label: 'Eighth' },
          { value: '3', label: 'Triplet' },
          { value: '4', label: 'Sixteenth' },
        ]}
        onChange={(v) => onChange({ ...pattern, subdivision: Number(v) })}
      />
      <Choices
        label="Choose an action, then tap a position"
        value={brush}
        options={[
          ...Object.entries(ACTIONS).map(([value, a]) => ({
            value: value as StrumAction | 'erase',
            label: `${a.symbol} ${a.label}`,
          })),
          { value: 'erase', label: 'Erase' },
        ]}
        onChange={setBrush}
      />
      <View style={s.row}>
        {Array.from(
          { length: pattern.beatsPerBar * pattern.bars * pattern.subdivision },
          (_, i) => {
            const beat = i / pattern.subdivision;
            const event = pattern.events.find((e) => Math.abs(e.beat - beat) < 0.0001);
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Count ${beatCount(beat, pattern.beatsPerBar)}, ${event ? ACTIONS[event.action].label : 'empty'}. Place ${brush}.`}
                style={[s.tile, event && s.selected]}
                onPress={() =>
                  onChange({
                    ...pattern,
                    events: [
                      ...pattern.events.filter((e) => Math.abs(e.beat - beat) >= 0.0001),
                      ...(brush === 'erase' ? [] : [{ id: uid(), beat, action: brush }]),
                    ].sort((a, b) => a.beat - b.beat),
                  })
                }
              >
                <Text style={s.symbol}>{event ? ACTIONS[event.action].symbol : '·'}</Text>
                <Text style={s.caption}>{beatCount(beat, pattern.beatsPerBar)}</Text>
              </Pressable>
            );
          },
        )}
      </View>
      <Text style={s.caption}>
        Positions above start at 1. Fine-tune each action below with a zero-based beat offset (0 =
        first beat, 0.5 = its offbeat). Changing subdivision preserves action timing. Shortening the
        pattern removes positions outside it.
      </Text>
      {pattern.events.map((event) => (
        <View key={event.id} style={s.row}>
          <Text style={s.symbol}>{ACTIONS[event.action].symbol}</Text>
          <NumberField
            label={`${ACTIONS[event.action].label} offset`}
            value={event.beat}
            onChange={(beat) =>
              onChange({
                ...pattern,
                events: pattern.events.map((e) => (e.id === event.id ? { ...e, beat } : e)),
              })
            }
            max={pattern.beatsPerBar * pattern.bars - 0.01}
          />
          <IconButton
            icon="trash-2"
            label={`Remove ${ACTIONS[event.action].label} at ${event.beat}`}
            onPress={() =>
              onChange({ ...pattern, events: pattern.events.filter((e) => e.id !== event.id) })
            }
          />
        </View>
      ))}
      <ActionButton
        icon="plus"
        label="Add action at first empty position"
        disabled={pattern.events.length >= pattern.beatsPerBar * pattern.bars * pattern.subdivision}
        onPress={() => {
          const beat = Array.from(
            { length: pattern.beatsPerBar * pattern.bars * pattern.subdivision },
            (_, i) => i / pattern.subdivision,
          ).find((p) => !pattern.events.some((e) => e.beat === p));
          if (beat !== undefined)
            onChange({
              ...pattern,
              events: [
                ...pattern.events,
                { id: uid(), action: brush === 'erase' ? 'down' : brush, beat },
              ].sort((a, b) => a.beat - b.beat),
            });
        }}
      />
    </View>
  );
}
