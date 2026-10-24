/** Integer-cycle PCM keeps the loop boundary in phase without retuning by an audible amount. */
export function createDroneLoop(hz: number, sampleRate = 24000, seconds = 8) {
  if (!Number.isFinite(hz) || hz <= 0 || hz >= sampleRate / 6)
    throw new RangeError('Drone frequency must fit within the sample rate.');
  const cycles = Math.round(hz * seconds);
  const frameCount = Math.round((cycles * sampleRate) / hz);
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    const phase = (2 * Math.PI * cycles * frame) / frameCount;
    samples[frame] = 0.22 * (Math.sin(phase) + 0.12 * Math.sin(phase * 2));
  }
  return { samples, sampleRate, cycles, frequency: (cycles * sampleRate) / frameCount };
}
