import { Text, View } from 'react-native';
import { clockTime } from './model';
import { activeMs, weeklySummary, type PracticeSession } from './session';
import { useStudio } from './StudioProvider';
import { s, StudioPage } from './StudioShared';
import { colors } from '../../theme/theme';

export function WeeklySummary({ sessions }: { sessions: PracticeSession[] }) {
  const { data } = useStudio();
  const summary = weeklySummary(sessions, new Date(), data.freePractice);
  const max = Math.max(...summary.days.map((d) => d.activeMs), 60000);
  return (
    <View style={s.card}>
      <Text style={s.badge}>YOUR WEEK · MON–SUN</Text>
      <Text style={s.statNumber}>
        {Number((summary.weekMs / 60000).toFixed(1))}{' '}
        <Text style={s.caption}>minutes practiced this week</Text>
      </Text>
      <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'flex-end', gap: 8 }]}>
        {summary.days.map((day) => (
          <View
            key={day.date.toISOString()}
            style={{ flex: 1, alignItems: 'center', gap: 8 }}
            accessibilityLabel={`${day.date.toLocaleDateString()}: ${(day.activeMs / 60000).toFixed(1)} minutes`}
          >
            <Text style={s.caption}>{Math.round(day.activeMs / 60000)}</Text>
            <View
              style={{
                width: '100%',
                maxWidth: 42,
                height: Math.max(4, (day.activeMs / max) * 68),
                borderRadius: 6,
                backgroundColor: day.activeMs ? colors.lime : colors.line,
              }}
            />
            <Text style={s.caption}>
              {day.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </Text>
          </View>
        ))}
      </View>
      <Text style={s.caption}>
        {Number((summary.totalMs / 60000).toFixed(1))} total minutes practiced · time grouped by
        local practice day
      </Text>
    </View>
  );
}
export default function PracticeHistory() {
  const { data } = useStudio();
  return (
    <StudioPage home title="Practice history.">
      <WeeklySummary sessions={data.sessions} />
      {!data.sessions.length && !data.freePractice.length && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Your first session starts a story.</Text>
          <Text style={s.body}>
            Routine sessions and free practice appear here. Pauses, breaks, count-ins, and skipped
            time never inflate routine totals.
          </Text>
        </View>
      )}
      {data.freePractice.map((session) => (
        <View key={session.id} style={s.card}>
          <Text style={s.caption}>{new Date(session.startedAt).toLocaleString()}</Text>
          <Text style={s.cardTitle}>Metronome practice</Text>
          <Text style={[s.body, s.lime]}>
            {clockTime(session.activeMs)} practiced · saved on this device
          </Text>
        </View>
      ))}
      {data.sessions.map((session) => (
        <View key={session.id} style={s.card}>
          <Text style={s.caption}>{new Date(session.startedAt).toLocaleString()}</Text>
          <Text style={s.cardTitle}>{session.routine.name}</Text>
          <Text style={[s.body, s.lime]}>
            {clockTime(activeMs(session))} practiced ·{' '}
            {session.phase === 'finished'
              ? session.results.every((r) => r.state === 'completed')
                ? 'Completed'
                : 'Partial session'
              : 'In progress · saved checkpoint'}
          </Text>
          {session.results.map((result) => (
            <View key={result.blockId} style={s.between}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{result.name}</Text>
                <Text style={s.caption}>
                  {result.bpm} BPM · {result.state === 'active' ? 'in progress' : result.state}
                </Text>
              </View>
              <Text style={s.badge}>{clockTime(result.activeMs)}</Text>
            </View>
          ))}
        </View>
      ))}
    </StudioPage>
  );
}
