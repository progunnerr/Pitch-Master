export const SEMITONE_ANGLE = Math.PI / 6;
export const FULL_TURN = Math.PI * 2;

export function normalizePitch(value: number): number {
  'worklet';
  return ((value % 12) + 12) % 12;
}

export function shortestAngle(delta: number): number {
  'worklet';
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

export function snappedTonic(angle: number): number {
  'worklet';
  return normalizePitch(Math.round(angle / SEMITONE_ANGLE));
}

export function pitchAtPoint(x: number, y: number, size: number, outerRotation = 0): number | null {
  'worklet';
  const dx = x - size / 2;
  const dy = y - size / 2;
  const distance = Math.hypot(dx, dy);
  if (distance < size * 0.22 || distance > size * 0.48) return null;
  return snappedTonic(Math.atan2(dy, dx) + Math.PI / 2 - outerRotation);
}

export function pointOnWheel(
  pitch: number,
  radius: number,
  center: number,
): { x: number; y: number } {
  const angle = pitch * SEMITONE_ANGLE - Math.PI / 2;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}
