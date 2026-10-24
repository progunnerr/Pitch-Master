import {
  createAudioPlayer,
  type AudioPlayer,
  type AudioSource,
  type AudioStatus,
} from 'expo-audio';
import type { PitchVoice } from './PitchEngine';

function waitForLoad(player: AudioPlayer, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error('Audio player was released.'));
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let subscription: { remove(): void } | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      subscription?.remove();
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      cleanup();
      reject(new Error('Audio player was released.'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Audio took too long to load.'));
    }, 6000);
    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) {
        cleanup();
        resolve();
      }
    });
    signal.addEventListener('abort', cancel, { once: true });
    if (player.isLoaded) {
      cleanup();
      resolve();
    }
  });
}

export function createExpoVoice(
  source: AudioSource,
  loop: boolean,
  onStatus: (status: AudioStatus) => void,
): PitchVoice {
  const player = createAudioPlayer(source, { updateInterval: 100, keepAudioSessionActive: false });
  player.loop = loop;
  const lifetime = new AbortController();
  const subscription = player.addListener('playbackStatusUpdate', onStatus);
  return {
    rewind: async () => {
      await waitForLoad(player, lifetime.signal);
      if (!lifetime.signal.aborted && player.currentTime !== 0) await player.seekTo(0);
    },
    play: () => player.play(),
    pause: () => player.pause(),
    setVolume: (volume) => {
      player.volume = volume;
    },
    dispose: () => {
      lifetime.abort();
      subscription.remove();
      player.remove();
    },
  };
}
