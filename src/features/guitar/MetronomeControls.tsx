import { Text, View } from 'react-native';
import { ActionButton, IconButton } from '../../components/Controls';
import { METRONOME_SOUNDS, type MetronomeSound, type Subdivision } from './metronome';
import { practiceDuration } from './practiceTime';
import { useStudio } from './StudioProvider';
import { Choices, s, Toggle } from './StudioShared';

export function PracticeTimer({ currentMs, todayMs }: { currentMs: number; todayMs: number }) {
  return (
    <View style={s.row}>
      <Text style={s.body} accessibilityLabel={`Current practice ${practiceDuration(currentMs)}`}>
        Practice · {practiceDuration(currentMs)}
      </Text>
      <Text style={s.body} accessibilityLabel={`Today's practice ${practiceDuration(todayMs)}`}>
        Today · {practiceDuration(todayMs)}
      </Text>
    </View>
  );
}
export function MetronomeControls({
  practiceMode,
  onPracticeMode,
  previewSound,
}: {
  practiceMode: boolean;
  onPracticeMode: (enabled: boolean) => void;
  previewSound: (sound: MetronomeSound) => void;
}) {
  const { data, change } = useStudio();
  const settings = data.metronome;
  const setVolume = (volume: number) =>
    change((d) => ({
      ...d,
      metronome: { ...d.metronome, volume: Math.max(0, Math.min(100, volume)) },
    }));
  return (
    <View style={s.section}>
      <View style={s.row}>
        <ActionButton
          icon={data.settings.metronome ? 'volume-2' : 'volume-x'}
          label={data.settings.metronome ? 'Mute' : 'Unmute'}
          onPress={() =>
            change((d) => ({ ...d, settings: { ...d.settings, metronome: !d.settings.metronome } }))
          }
        />
      </View>
      <Toggle
        label={`Practice Mode ${practiceMode ? 'On' : 'Off'}`}
        value={practiceMode}
        onChange={onPracticeMode}
      />
      <Choices
        label="Metronome subdivision"
        value={String(settings.subdivision)}
        options={[
          { value: '1', label: 'Quarter' },
          { value: '2', label: 'Eighth' },
          { value: '4', label: 'Sixteenth' },
        ]}
        onChange={(v) =>
          change((d) => ({
            ...d,
            metronome: { ...d.metronome, subdivision: Number(v) as Subdivision },
          }))
        }
      />
      <Text style={s.caption}>
        Quarter shows 1 2 3 4. Eighth adds & counts; sixteenth adds e & a. Extra clicks are softer.
      </Text>
      <View style={s.between}>
        <Text style={[s.body, { flex: 1 }]}>Metronome volume · {settings.volume}%</Text>
        <View style={s.row}>
          <IconButton
            icon="minus"
            label="Decrease metronome volume"
            disabled={settings.volume <= 0}
            onPress={() => setVolume(settings.volume - 10)}
          />
          <IconButton
            icon="plus"
            label="Increase metronome volume"
            disabled={settings.volume >= 100}
            onPress={() => setVolume(settings.volume + 10)}
          />
        </View>
      </View>
      <Choices
        label="Metronome sound"
        value={settings.sound}
        options={METRONOME_SOUNDS.map((value) => ({ value, label: value }))}
        onChange={(sound) => change((d) => ({ ...d, metronome: { ...d.metronome, sound } }))}
      />
      <View style={s.row}>
        {METRONOME_SOUNDS.map((sound) => (
          <ActionButton
            key={sound}
            icon="play"
            label={`Preview ${sound}`}
            disabled={!data.settings.metronome || settings.volume === 0}
            onPress={() => previewSound(sound)}
          />
        ))}
      </View>
      <Text style={s.caption}>
        Preview plays one bar. Traditional uses a bell accent; Wood1 a higher woodblock; Drums a
        snare accent.
      </Text>
      <Toggle
        label="Accent beat 1"
        value={settings.accents}
        onChange={(accents) => change((d) => ({ ...d, metronome: { ...d.metronome, accents } }))}
      />
    </View>
  );
}
