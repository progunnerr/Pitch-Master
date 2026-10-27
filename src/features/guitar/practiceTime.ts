import { uid } from './model.ts';

export interface PracticeTime {
  activeMs: number;
  dailyMs: Record<string, number>;
}
export interface FreePractice extends PracticeTime {
  id: string;
  startedAt: string;
}
export function localDay(now: number) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Split elapsed time at local midnight, including DST, without counting callbacks. */
export function creditDays(dailyMs: Record<string, number>, from: number, to: number) {
  const next = { ...dailyMs };
  while (from < to) {
    const d = new Date(from);
    const end = Math.min(to, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime());
    const key = localDay(from);
    next[key] = (next[key] ?? 0) + end - from;
    from = end;
  }
  return next;
}
/** Epoch-shaped timestamps whose elapsed duration cannot jump with the system clock. */
export function createPracticeClock(wall = Date.now(), monotonic = () => performance.now()) {
  const start = monotonic();
  return () => wall + Math.max(0, monotonic() - start);
}
export interface FreeTransport {
  running: boolean;
  practiceMode: boolean;
  anchorMs: number | null;
  elapsedMs: number;
  practice: FreePractice;
}
export function createFreeTransport(now: number, practiceMode: boolean): FreeTransport {
  return {
    running: false,
    practiceMode,
    anchorMs: null,
    elapsedMs: 0,
    practice: { id: uid(), startedAt: new Date(now).toISOString(), activeMs: 0, dailyMs: {} },
  };
}
export function advanceFreeTransport(s: FreeTransport, now: number): FreeTransport {
  if (!s.running || s.anchorMs === null || now <= s.anchorMs) return s;
  const delta = now - s.anchorMs;
  return {
    ...s,
    anchorMs: now,
    elapsedMs: s.elapsedMs + delta,
    practice: !s.practiceMode
      ? s.practice
      : {
          ...s.practice,
          activeMs: s.practice.activeMs + delta,
          dailyMs: creditDays(s.practice.dailyMs, s.anchorMs, now),
        },
  };
}
export function updateFreeTransport(
  s: FreeTransport,
  now: number,
  update: Partial<Pick<FreeTransport, 'running' | 'practiceMode'>>,
) {
  const next = { ...advanceFreeTransport(s, now), ...update };
  next.anchorMs = next.running ? now : null;
  return next;
}
export function practiceDuration(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
