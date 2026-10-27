import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from '../../components/Controls';
import { copy, newBlock, routineSeconds, uid, type PracticeRoutine } from './model';
import { createSession, endSession } from './session';
import { useStudio } from './StudioProvider';
import { s, StudioPage, Toggle } from './StudioShared';
import { saveSession } from './storage';

export default function PracticeRoutines() {
  const { data, ready, change } = useStudio();
  const [deleting, setDeleting] = useState<string | null>(null);
  const active = data.sessions.find((v) => v.id === data.activeId);
  const start = useCallback(
    (routine: PracticeRoutine) => {
      const session = createSession(
        routine,
        Date.now(),
        data.settings.autoAdvance,
        data.settings.countIn,
      );
      // Opening a player never starts audio without its explicit Start control.
      session.anchorMs = null;
      change((d) => saveSession(d, session));
      router.push({ pathname: '/guitar/session', params: { id: session.id } });
    },
    [change, data.settings.autoAdvance, data.settings.countIn],
  );
  return (
    <StudioPage home title="Practice routines.">
      <Text style={s.subtitle}>
        Choose a routine and start playing, or build a practice that fits your day.
      </Text>
      {active && (
        <View style={[s.card, s.selected]}>
          <Text style={s.badge}>SAVED SESSION</Text>
          <Text style={s.cardTitle}>{active.routine.name}</Text>
          <ActionButton
            primary
            icon="play"
            label="Continue session"
            onPress={() => router.push({ pathname: '/guitar/session', params: { id: active.id } })}
          />
          <ActionButton
            icon="square"
            label="End session & save partial practice"
            onPress={() => change((d) => saveSession(d, endSession(active, Date.now())))}
          />
        </View>
      )}
      <ActionButton
        icon="plus"
        label="Create routine"
        onPress={() => {
          const routine = { id: uid(), name: 'My practice routine', blocks: [newBlock()] };
          change((d) => ({ ...d, routines: [...d.routines, routine] }));
          router.push({ pathname: '/guitar/routine', params: { id: routine.id } });
        }}
      />
      {!data.routines.length && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Make room for practice.</Text>
          <Text style={s.body}>
            Create a routine to put your exercises, tempo, and breaks in one place.
          </Text>
        </View>
      )}
      {data.routines.map((routine) => {
        const last = data.sessions.find((v) => v.routine.id === routine.id);
        return (
          <View key={routine.id} style={s.card}>
            <Text style={s.cardTitle}>{routine.name}</Text>
            <Text style={s.caption}>
              {routine.blocks.length} exercises ·{' '}
              {Number((routineSeconds(routine) / 60).toFixed(1))} minutes active · breaks extra
            </Text>
            <ActionButton
              primary
              icon="play"
              label="Start practice"
              disabled={!ready || !!active}
              onPress={() => start(routine)}
            />
            {routine.blocks.map((b, i) => (
              <View key={b.id} style={s.section}>
                <Text style={s.body}>
                  {i + 1}. {b.name} · {Number((b.durationSeconds / 60).toFixed(2))} min
                </Text>
                {last?.results.find((v) => v.blockId === b.id) && (
                  <Text style={s.caption}>
                    Last session: {last.results.find((v) => v.blockId === b.id)!.state}
                  </Text>
                )}
              </View>
            ))}
            <View style={s.row}>
              <ActionButton
                icon="edit-3"
                label="Edit"
                onPress={() =>
                  router.push({ pathname: '/guitar/routine', params: { id: routine.id } })
                }
              />
              <ActionButton
                icon="copy"
                label="Duplicate"
                onPress={() =>
                  change((d) => ({
                    ...d,
                    routines: [
                      ...d.routines,
                      { ...copy(routine), id: uid(), name: `${routine.name} (copy)` },
                    ],
                  }))
                }
              />
              <ActionButton icon="trash-2" label="Delete" onPress={() => setDeleting(routine.id)} />
            </View>
            {deleting === routine.id && (
              <View style={s.warning}>
                <Text style={s.body}>
                  Delete “{routine.name}”? Saved practice history will remain.
                </Text>
                <View style={s.row}>
                  <ActionButton
                    icon="trash-2"
                    label="Delete routine"
                    onPress={() => {
                      change((d) => ({
                        ...d,
                        routines: d.routines.filter((r) => r.id !== routine.id),
                      }));
                      setDeleting(null);
                    }}
                  />
                  <ActionButton icon="x" label="Cancel" onPress={() => setDeleting(null)} />
                </View>
              </View>
            )}
          </View>
        );
      })}
      <View style={s.card}>
        <Text style={s.cardTitle}>Session preferences</Text>
        <Toggle
          label="Advance exercises automatically"
          value={data.settings.autoAdvance}
          onChange={(autoAdvance) =>
            change((d) => ({ ...d, settings: { ...d.settings, autoAdvance } }))
          }
        />
        <Toggle
          label="One-bar count-in before each exercise"
          value={data.settings.countIn}
          onChange={(countIn) => change((d) => ({ ...d, settings: { ...d.settings, countIn } }))}
        />
        <Text style={s.caption}>
          Settings apply to new sessions. Audio and practice time pause when you leave the player or
          background the app.
        </Text>
      </View>
      <Text style={s.caption}>Saved on this device. No account or internet connection needed.</Text>
    </StudioPage>
  );
}
