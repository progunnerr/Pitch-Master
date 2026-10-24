import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { midiNote } from '../../domain/musicTheory';
import { DRONE_ASSETS } from './droneAssets';
import { createExpoVoice } from './expoVoice';
import { PitchEngine } from './PitchEngine';

/** Drone intent is session-only: restoring preferences never starts sound by itself. */
export function useTonicDrone(tonic: number, octave: number, volume: number) {
  const engine = useRef<PitchEngine | null>(null);
  const activeMidi = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [soundingMidi, setSoundingMidi] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targetMidi = midiNote(tonic, octave);

  const stop = useCallback(() => {
    activeMidi.current = null;
    engine.current?.stop();
    setEnabled(false);
    setSoundingMidi(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    const instance = new PitchEngine((midi) => {
      const source = DRONE_ASSETS[midi];
      if (source === undefined) throw new Error('Drone octave is unavailable.');
      return createExpoVoice(source, true, (status) => {
        if (
          mounted &&
          activeMidi.current === midi &&
          !status.playing &&
          !status.didJustFinish &&
          !status.isBuffering &&
          status.currentTime > 0
        )
          stop();
      });
    }, 1);
    engine.current = instance;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => {
      mounted = false;
      activeMidi.current = null;
      subscription.remove();
      instance.dispose();
      engine.current = null;
    };
  }, [stop]);

  useEffect(() => {
    engine.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    let cancelled = false;
    activeMidi.current = null;
    const instance = engine.current;
    instance?.stop();
    if (enabled) {
      instance
        ?.play(targetMidi)
        .then((played) => {
          if (!cancelled && played) {
            activeMidi.current = targetMidi;
            setSoundingMidi(targetMidi);
            setError(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            stop();
            setError('The tonic drone could not start. Tap Start drone to retry.');
          }
        });
    }
    return () => {
      cancelled = true;
      activeMidi.current = null;
      instance?.stop();
    };
  }, [enabled, targetMidi, stop]);

  const toggle = useCallback(() => {
    if (enabled) stop();
    else {
      setSoundingMidi(null);
      setEnabled(true);
      setError(null);
    }
  }, [enabled, stop]);

  return { enabled, loading: enabled && soundingMidi !== targetMidi, toggle, stop, error };
}
