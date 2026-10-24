export interface PitchVoice {
  rewind(): Promise<void>;
  play(): void;
  pause(): void;
  setVolume(volume: number): void;
  dispose(): void;
}

/** A single voice at a time; stale seeks can never restart a stopped note. */
export class PitchEngine {
  private voices = new Map<number, PitchVoice>();
  private generation = 0;
  private disposed = false;
  private queue = Promise.resolve();
  private volume = 0.65;

  private createVoice: (midi: number) => PitchVoice;
  private cacheLimit: number;

  constructor(createVoice: (midi: number) => PitchVoice, cacheLimit = 48) {
    if (!Number.isInteger(cacheLimit) || cacheLimit < 1)
      throw new RangeError('Voice cache must hold at least one pitch.');
    this.createVoice = createVoice;
    this.cacheLimit = cacheLimit;
  }

  preload(notes: number[]): void {
    if (this.disposed) return;
    for (const midi of notes) this.voice(midi);
  }

  private voice(midi: number): PitchVoice {
    let voice = this.voices.get(midi);
    if (!voice) {
      if (this.voices.size >= this.cacheLimit) {
        const oldest = this.voices.keys().next().value;
        if (oldest !== undefined) {
          this.voices.get(oldest)?.pause();
          this.voices.get(oldest)?.dispose();
          this.voices.delete(oldest);
        }
      }
      voice = this.createVoice(midi);
      voice.setVolume(this.volume);
      this.voices.set(midi, voice);
    }
    return voice;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    for (const voice of this.voices.values()) voice.setVolume(this.volume);
  }

  stop(): void {
    this.generation++;
    for (const voice of this.voices.values()) voice.pause();
  }

  play(midi: number): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    this.stop();
    const request = this.generation;
    let played = false;
    const operation = this.queue.then(async () => {
      if (this.disposed || request !== this.generation) return;
      const voice = this.voice(midi);
      await voice.rewind();
      if (this.disposed || request !== this.generation) return;
      voice.play();
      played = true;
    });
    // Keep the queue usable after a failed load; the caller receives the error.
    this.queue = operation.catch(() => {});
    return operation.then(() => played);
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    for (const voice of this.voices.values()) voice.dispose();
    this.voices.clear();
  }
}
