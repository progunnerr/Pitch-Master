import { setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  midiNote,
  mod12,
  scaleMidiNotes,
  type Direction,
  type ScaleId,
} from '../../domain/musicTheory';
import { createExpoVoice } from './expoVoice';
import { PitchEngine } from './PitchEngine';
import { TONE_ASSETS } from './toneAssets';

export function usePitchAudio(octave: number, volume: number) {
  const engine = useRef<PitchEngine | null>(null);
  const activeMidi = useRef<number | null>(null);
  const generations = useRef({ sequence: 0, request: 0 });
  const pendingDelay = useRef<{ timer: ReturnType<typeof setTimeout>; resolve: () => void } | null>(
    null,
  );
  const [playback, setPlayback] = useState<{ midi: number; octave: number } | null>(null);
  const [sequenceOctave, setSequenceOctave] = useState<number | null>(null);
  const playingMidi = playback?.octave === octave ? playback.midi : null;
  const sequencePlaying = sequenceOctave === octave;
  const [audioError, setAudioError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const cancelPlayback = useCallback(() => {
    generations.current.sequence++;
    generations.current.request++;
    if (pendingDelay.current) {
      clearTimeout(pendingDelay.current.timer);
      pendingDelay.current.resolve();
      pendingDelay.current = null;
    }
    engine.current?.stop();
    activeMidi.current = null;
  }, []);

  const stop = useCallback(() => {
    cancelPlayback();
    setPlayback(null);
    setSequenceOctave(null);
  }, [cancelPlayback]);

  useEffect(() => {
    let mounted = true;
    const lifecycle = generations.current;
    const instance = new PitchEngine((midi) => {
      const source = TONE_ASSETS[midi];
      if (source === undefined) throw new Error('This pitch is outside the supported octaves.');
      return createExpoVoice(source, false, (status) => {
        if (
          mounted &&
          activeMidi.current === midi &&
          (status.didJustFinish ||
            (!status.playing && status.currentTime > 0 && !status.isBuffering))
        ) {
          activeMidi.current = null;
          setPlayback(null);
          // A system interruption also cancels the rest of a sequence.
          if (!status.didJustFinish) stop();
        }
      });
    });
    engine.current = instance;
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    })
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch(() => {
        if (mounted) setAudioError('Audio is unavailable. Tap a note to try again.');
      });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => {
      mounted = false;
      lifecycle.sequence++;
      lifecycle.request++;
      if (pendingDelay.current) {
        clearTimeout(pendingDelay.current.timer);
        pendingDelay.current.resolve();
        pendingDelay.current = null;
      }
      subscription.remove();
      instance.dispose();
      engine.current = null;
    };
  }, [stop]);

  useEffect(() => {
    cancelPlayback();
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled)
          engine.current?.preload(
            Array.from({ length: 12 }, (_, pitch) => midiNote(pitch, octave)),
          );
      })
      .catch(() => {
        if (!cancelled) setAudioError('Some audio could not be loaded. Tap a note to retry.');
      });
    return () => {
      cancelled = true;
    };
  }, [octave, cancelPlayback]);

  useEffect(() => {
    engine.current?.setVolume(volume);
  }, [volume]);

  const playMidi = useCallback(
    async (midi: number): Promise<boolean> => {
      const request = ++generations.current.request;
      activeMidi.current = null;
      try {
        const played = await engine.current?.play(midi);
        if (played && request === generations.current.request) {
          activeMidi.current = midi;
          setPlayback({ midi, octave });
          setAudioError(null);
          setReady(true);
          return true;
        }
      } catch {
        if (request === generations.current.request) {
          activeMidi.current = null;
          setPlayback(null);
          setAudioError('Could not play this note. Tap it to retry.');
        }
      }
      return false;
    },
    [octave],
  );

  const playNote = useCallback(
    (pitch: number) => {
      stop();
      void playMidi(midiNote(pitch, octave));
    },
    [octave, playMidi, stop],
  );

  const playSequence = useCallback(
    async (notes: readonly number[], tempo: number): Promise<boolean> => {
      stop();
      if (!notes.length || !Number.isFinite(tempo) || tempo < 40 || tempo > 200) return false;
      const id = generations.current.sequence;
      setSequenceOctave(octave);
      for (const midi of notes) {
        if (id !== generations.current.sequence) return false;
        const played = await playMidi(midi);
        if (!played || id !== generations.current.sequence) {
          if (id === generations.current.sequence) stop();
          return false;
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            pendingDelay.current = null;
            resolve();
          }, 60000 / tempo);
          pendingDelay.current = { timer, resolve };
        });
      }
      if (id !== generations.current.sequence) return false;
      stop();
      return true;
    },
    [octave, playMidi, stop],
  );

  const playScale = useCallback(
    (tonic: number, scale: ScaleId, tempo: number, direction: Direction) =>
      playSequence(scaleMidiNotes(tonic, octave, scale, direction), tempo),
    [octave, playSequence],
  );

  return {
    playNote,
    playScale,
    playSequence,
    stop,
    playingMidi,
    playingPitch: playingMidi === null ? null : mod12(playingMidi),
    sequencePlaying,
    audioError,
    ready,
  };
}
