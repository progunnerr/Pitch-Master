import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton, Eyebrow, IconButton } from '../../components/Controls';
import {
  copy,
  newBlock,
  PRESET_PATTERNS,
  routineError,
  routineSeconds,
  uid,
  type ExerciseBlock,
  type PracticeRoutine,
} from './model';
import { PatternEditor, PatternStrip } from './PatternEditor';
import { ProgressionEditor } from './ProgressionEditor';
import { useStudio } from './StudioProvider';
import { Choices, Field, NumberField, s, StudioPage } from './StudioShared';

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, ready } = useStudio();
  const routine = data.routines.find((r) => r.id === id);
  return (
    <StudioPage title="Build your practice.">
      {ready &&
        (routine ? (
          <Editor key={id} initial={routine} />
        ) : (
          <Text style={s.body}>
            This routine is no longer available. Return to Routines to create one.
          </Text>
        ))}
    </StudioPage>
  );
}
function Editor({ initial }: { initial: PracticeRoutine }) {
  const { data, change } = useStudio();
  const [routine, setRoutine] = useState(() => copy(initial));
  const [expanded, setExpanded] = useState<string | null>(routine.blocks[0]?.id ?? null);
  const [customPattern, setCustomPattern] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const update = (id: string, patch: Partial<ExerciseBlock>) => {
    setMessage(null);
    setRoutine((r) => ({
      ...r,
      blocks: r.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  };
  const move = (index: number, direction: number) =>
    setRoutine((r) => {
      const blocks = [...r.blocks];
      const to = index + direction;
      if (to >= 0 && to < blocks.length)
        [blocks[index], blocks[to]] = [blocks[to]!, blocks[index]!];
      return { ...r, blocks };
    });
  const error = routineError(routine);
  return (
    <>
      <View style={s.card}>
        <Field
          label="Routine name"
          value={routine.name}
          onChange={(name) => {
            setMessage(null);
            setRoutine((r) => ({ ...r, name }));
          }}
        />
        <Text style={s.statNumber}>
          {Number((routineSeconds(routine) / 60).toFixed(1))} min{' '}
          <Text style={s.caption}>active practice</Text>
        </Text>
        <Text style={s.caption}>
          {routine.blocks.length} exercises ·{' '}
          {routine.blocks.reduce((sum, b) => sum + b.breakSeconds, 0)} seconds of breaks, plus
          count-ins. Save your changes below.
        </Text>
      </View>
      {routine.blocks.map((block, i) => (
        <View key={block.id} style={s.card}>
          <Eyebrow>{`EXERCISE ${i + 1}`}</Eyebrow>
          <View style={s.between}>
            <Text style={[s.cardTitle, { flex: 1 }]}>{block.name || 'Untitled exercise'}</Text>
            <IconButton
              icon={expanded === block.id ? 'chevron-up' : 'chevron-down'}
              label={`Edit exercise ${i + 1}`}
              onPress={() => setExpanded(expanded === block.id ? null : block.id)}
            />
          </View>
          <Text style={s.caption}>
            {Number((block.durationSeconds / 60).toFixed(2))} min · {block.bpm} BPM · {block.type}
            {block.breakSeconds > 0 ? ` · ${block.breakSeconds}s break` : ''}
          </Text>
          {expanded === block.id && (
            <>
              <Field
                label={`Exercise ${i + 1} name`}
                value={block.name}
                onChange={(name) => update(block.id, { name })}
              />
              <Choices
                label="Exercise type"
                value={block.type}
                options={[
                  { value: 'strumming', label: 'Strumming' },
                  { value: 'transitions', label: 'Chords' },
                  { value: 'combined', label: 'Together' },
                ]}
                onChange={(type) => update(block.id, { type })}
              />
              <View style={s.row}>
                <NumberField
                  label="Duration (minutes)"
                  value={block.durationSeconds / 60}
                  min={1 / 60}
                  max={120}
                  onChange={(v) => update(block.id, { durationSeconds: Math.round(v * 60) })}
                />
                <NumberField
                  label="BPM (40–160)"
                  value={block.bpm}
                  min={40}
                  max={160}
                  onChange={(v) => update(block.id, { bpm: Math.round(v) })}
                />
                <NumberField
                  label="Break after (seconds)"
                  value={block.breakSeconds}
                  max={1800}
                  onChange={(v) => update(block.id, { breakSeconds: Math.round(v) })}
                />
              </View>
              <Choices
                label="Pattern"
                value={block.pattern.id}
                options={data.patterns.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(id) =>
                  update(block.id, { pattern: copy(data.patterns.find((p) => p.id === id)!) })
                }
              />
              <PatternStrip pattern={block.pattern} />
              <ActionButton
                icon="edit-3"
                label={
                  customPattern === block.id
                    ? 'Close timing editor'
                    : 'Edit actions & beat positions'
                }
                onPress={() => setCustomPattern(customPattern === block.id ? null : block.id)}
              />
              {customPattern === block.id && (
                <PatternEditor
                  pattern={block.pattern}
                  onChange={(pattern) => update(block.id, { pattern })}
                />
              )}
              {block.type !== 'strumming' && (
                <ProgressionEditor
                  value={block.progression}
                  onChange={(progression) => update(block.id, { progression })}
                />
              )}
            </>
          )}
          <View style={s.row}>
            <IconButton
              icon="arrow-up"
              label={`Move exercise ${i + 1} earlier`}
              disabled={i === 0}
              onPress={() => move(i, -1)}
            />
            <IconButton
              icon="arrow-down"
              label={`Move exercise ${i + 1} later`}
              disabled={i === routine.blocks.length - 1}
              onPress={() => move(i, 1)}
            />
            <IconButton
              icon="copy"
              label={`Duplicate exercise ${i + 1}`}
              disabled={routine.blocks.length >= 40}
              onPress={() => {
                const next = { ...copy(block), id: uid() };
                setRoutine((r) => ({
                  ...r,
                  blocks: [...r.blocks.slice(0, i + 1), next, ...r.blocks.slice(i + 1)],
                }));
                setExpanded(next.id);
              }}
            />
            <IconButton
              icon="trash-2"
              label={`Remove exercise ${i + 1}`}
              onPress={() =>
                setRoutine((r) => ({ ...r, blocks: r.blocks.filter((b) => b.id !== block.id) }))
              }
            />
          </View>
        </View>
      ))}
      <ActionButton
        icon="plus"
        label="Add exercise"
        disabled={routine.blocks.length >= 40}
        onPress={() => {
          const block = newBlock(data.patterns[0] ?? PRESET_PATTERNS[0]!);
          setRoutine((r) => ({ ...r, blocks: [...r.blocks, block] }));
          setExpanded(block.id);
        }}
      />
      {error && (
        <Text accessibilityRole="alert" style={[s.body, s.error]}>
          {error}
        </Text>
      )}
      {message && (
        <Text accessibilityLiveRegion="polite" style={[s.body, s.lime]}>
          {message}
        </Text>
      )}
      <ActionButton
        primary
        icon="save"
        label="Save routine"
        disabled={!!error}
        onPress={() => {
          const saved = { ...copy(routine), name: routine.name.trim() };
          change((d) => ({
            ...d,
            routines: d.routines.map((r) => (r.id === saved.id ? saved : r)),
          }));
          setMessage('Routine saved on this device.');
        }}
      />
      <ActionButton
        icon="arrow-left"
        label="Return to routines"
        onPress={() => router.dismissTo('/guitar/routines')}
      />
    </>
  );
}
