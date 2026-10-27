import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { loopPosition, metronomeGain, type MetronomeSound, type Subdivision } from './metronome';
import { METRONOME_LOOPS, METRONOME_PREVIEWS } from './metronomeAssets';

function waitForLoad(instance: AudioPlayer) {
  if (instance.isLoaded) return { promise: Promise.resolve(), cancel: () => {} };
  let cancel = () => {};
  const promise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error('Audio load timeout'));
    }, 6000);
    const subscription = instance.addListener('playbackStatusUpdate', (status) => {
      if (!status.isLoaded && !status.error) return;
      clearTimeout(timeout);
      subscription.remove();
      if (status.error) reject(new Error(status.error));
      else resolve();
    });
    cancel = () => {
      clearTimeout(timeout);
      subscription.remove();
      resolve();
    };
  });
  return { promise, cancel: () => cancel() };
}

/** Native PCM loops own click spacing. A replacement loads beside the playing loop,
 * then takes over at the same position; sound/volume/mute never reset the transport. */
export function useMetronome({
  running,
  bpm,
  beatsPerBar,
  muted,
  volume,
  sound,
  subdivision,
  accents,
  offsetMs = 0,
  transportKey = '',
  onInterrupt,
}: {
  running: boolean;
  bpm: number;
  beatsPerBar: number;
  muted: boolean;
  volume: number;
  sound: MetronomeSound;
  subdivision: Subdivision;
  accents: boolean;
  offsetMs?: number;
  transportKey?: string;
  onInterrupt: (reason: string) => void;
}) {
  const player = useRef<AudioPlayer | null>(null);
  const preview = useRef<AudioPlayer | null>(null);
  const pending = useRef<AudioPlayer | null>(null);
  const generation = useRef(0);
  const expected = useRef(false);
  const desired = useRef(false);
  const heard = useRef(false);
  const latest = useRef({ bpm, offsetMs, muted, volume, accents, onInterrupt });
  useEffect(() => {
    latest.current = { bpm, offsetMs, muted, volume, accents, onInterrupt };
  }, [bpm, offsetMs, muted, volume, accents, onInterrupt]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);
  const [totalBeat, setTotalBeat] = useState(0);
  // Keep source time across loop wraps; offsetMs only seeds a new transport.
  const position = useRef({ seconds: 0, at: 0, playing: false });
  const displayedSeconds = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
    expected.current = false;
    desired.current = false;
    heard.current = false;
    position.current.playing = false;
    player.current?.pause();
    pending.current?.pause();
    preview.current?.pause();
  }, []);
  const source =
    METRONOME_LOOPS[`${sound}-${beatsPerBar}-${subdivision}-${accents ? 'accent' : 'plain'}`]!;
  useEffect(() => {
    let alive = true;
    const instance = createAudioPlayer(source, {
      updateInterval: 50,
      keepAudioSessionActive: false,
    });
    pending.current = instance;
    instance.volume = 0;
    instance.loop = true;
    instance.shouldCorrectPitch = false;
    let playingSubscription: { remove: () => void } | undefined;
    const load = waitForLoad(instance);
    void Promise.all([
      load.promise,
      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      }),
    ])
      .then(async () => {
        if (!alive) return;
        let request: number;
        let seconds: number;
        let continuousSeconds: number;
        instance.setPlaybackRate(latest.current.bpm / 80);
        do {
          request = generation.current;
          const p = position.current;
          continuousSeconds = p.playing
            ? p.seconds + (((performance.now() - p.at) / 1000) * latest.current.bpm) / 80
            : ((latest.current.offsetMs / 1000) * latest.current.bpm) / 80;
          seconds = continuousSeconds % (beatsPerBar * 0.75);
          await instance.seekTo(seconds, 0, 0);
        } while (alive && desired.current && request !== generation.current);
        if (!alive) return;
        // Supersede any Start seek on the old source, including a rapid preset
        // change before its first playing status. Stop always clears desired.
        generation.current++;
        expected.current = desired.current;
        const old = player.current;
        player.current = instance;
        pending.current = null;
        position.current = { seconds: continuousSeconds, at: performance.now(), playing: false };
        // Replace before pausing so the old status listener cannot report an interruption.
        old?.pause();
        old?.remove();
        instance.volume = metronomeGain(latest.current.muted, latest.current.volume);
        heard.current = false;
        playingSubscription = instance.addListener('playbackStatusUpdate', (status) => {
          if (player.current !== instance) return;
          const at = performance.now();
          const p = position.current;
          const projected =
            p.seconds + (p.playing ? (((at - p.at) / 1000) * latest.current.bpm) / 80 : 0);
          const duration = beatsPerBar * 0.75;
          // Native currentTime wraps each bar. Match its phase to the continuous
          // clock, rather than repeatedly inferring a bar from the practice timer.
          const loops = Math.round((projected - status.currentTime) / duration);
          position.current = {
            seconds: Math.max(p.seconds, loops * duration + status.currentTime),
            at,
            playing: status.playing,
          };
          if (status.playing) {
            heard.current = true;
            setError(null);
          }
          if (
            expected.current &&
            (status.error ||
              status.mediaServicesDidReset ||
              (heard.current && !status.playing && !status.didJustFinish))
          ) {
            stop();
            latest.current.onInterrupt('Audio was interrupted. Resume when you’re ready.');
          }
        });
        if (desired.current) instance.play();
        setReady(true);
        setError(null);
      })
      .catch(() => {
        if (!alive) return;
        // Keep an already-playing loop intact if a replacement could not load.
        setError('Could not load this metronome sound. Select a sound to retry.');
        if (!player.current) latest.current.onInterrupt('Audio is unavailable. Practice paused.');
      });
    return () => {
      alive = false;
      load.cancel();
      // The active player stays alive until its replacement is ready.
      if (player.current !== instance) {
        playingSubscription?.remove();
        instance.remove();
      }
      if (pending.current === instance) pending.current = null;
    };
  }, [source, beatsPerBar, stop]);
  useEffect(() => {
    const value = metronomeGain(muted, volume);
    if (player.current) player.current.volume = value;
    if (preview.current) preview.current.volume = value;
  }, [muted, volume]);
  useEffect(() => {
    const instance = player.current;
    stop();
    if (!running || !ready || !instance) return;
    desired.current = true;
    const request = generation.current;
    const offset = latest.current.offsetMs;
    const seconds = ((offset / 1000) * bpm) / 80;
    instance.setPlaybackRate(bpm / 80);
    void instance
      .seekTo(loopPosition(offset, bpm, beatsPerBar), 0, 0)
      .then(() => {
        if (request !== generation.current) return;
        position.current = { seconds, at: performance.now(), playing: false };
        displayedSeconds.current = seconds;
        setBeat((seconds / 0.75) % beatsPerBar);
        setTotalBeat(seconds / 0.75);
        expected.current = true;
        instance.play();
      })
      .catch(() => {
        if (request !== generation.current) return;
        stop();
        setError('Could not start the metronome. Tap Start to retry.');
        latest.current.onInterrupt('Audio did not start. Practice paused.');
      });
    return stop;
  }, [running, bpm, beatsPerBar, ready, transportKey, stop]);
  useEffect(() => {
    const interrupt = () => {
      stop();
      latest.current.onInterrupt('Paused while the app was away. Resume when you’re ready.');
    };
    const state = AppState.addEventListener('change', (value) => {
      if (value !== 'active') interrupt();
    });
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', interrupt) : null;
    // AppState on web does not consistently report hidden browser tabs.
    const hidden = () => {
      if (document.hidden) interrupt();
    };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', hidden);
    return () => {
      state.remove();
      blur?.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', hidden);
      stop();
      player.current?.remove();
      player.current = null;
      preview.current?.remove();
      preview.current = null;
    };
  }, [stop]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const p = position.current;
      if (!p.playing) return;
      // A delayed native sample may correct the estimate backward. Hold the
      // displayed position until audio catches up so counts never flicker back.
      const seconds = Math.max(
        displayedSeconds.current,
        p.seconds + (((performance.now() - p.at) / 1000) * bpm) / 80,
      );
      displayedSeconds.current = seconds;
      const nextBeat = seconds / 0.75;
      setBeat(nextBeat % beatsPerBar);
      setTotalBeat(nextBeat);
    }, 50);
    return () => clearInterval(timer);
  }, [running, bpm, beatsPerBar]);
  const previewSound = useCallback((selected: MetronomeSound) => {
    preview.current?.remove();
    const source = latest.current.accents
      ? METRONOME_PREVIEWS[selected]
      : METRONOME_LOOPS[`${selected}-4-1-plain`]!;
    const instance = createAudioPlayer(source, {
      keepAudioSessionActive: false,
    });
    preview.current = instance;
    instance.volume = metronomeGain(latest.current.muted, latest.current.volume);
    instance.shouldCorrectPitch = false;
    instance.setPlaybackRate(latest.current.bpm / 80);
    // Preview is independent of the loop and never changes BPM or practice state.
    instance.play();
  }, []);
  return { beat, totalBeat, ready, error, stop, previewSound };
}
