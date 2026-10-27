import { useCallback, useEffect, useRef, useState } from 'react';
import {
  advanceFreeTransport,
  createFreeTransport,
  createPracticeClock,
  updateFreeTransport,
  type FreeTransport,
} from './practiceTime';
import { saveFreePractice } from './storage';
import { useStudio } from './StudioProvider';

/** The trainer's existing transport is the only clock; practice is a gated elapsed slice. */
export function useFreePractice() {
  const { data, change } = useStudio();
  const [now] = useState(() => createPracticeClock());
  const [transport, setTransport] = useState(() =>
    createFreeTransport(now(), data.metronome.practiceMode),
  );
  const latest = useRef(transport);
  const lastSave = useRef(0);
  const commit = useCallback(
    (next: FreeTransport, persist = true) => {
      latest.current = next;
      setTransport(next);
      if (persist && next.practice.activeMs > 0) {
        lastSave.current = now();
        change((d) => saveFreePractice(d, next.practice));
      }
    },
    [change, now],
  );
  const setRunning = useCallback(
    (running: boolean) => {
      commit(updateFreeTransport(latest.current, now(), { running }));
    },
    [commit, now],
  );
  const setPracticeMode = useCallback(
    (practiceMode: boolean) => {
      commit(updateFreeTransport(latest.current, now(), { practiceMode }));
      change((d) => ({ ...d, metronome: { ...d.metronome, practiceMode } }));
    },
    [change, commit, now],
  );
  const reset = useCallback(() => {
    // Commit the previous session before starting a fresh free-practice record.
    commit(updateFreeTransport(latest.current, now(), { running: false }));
    commit(createFreeTransport(now(), latest.current.practiceMode), false);
  }, [commit, now]);
  useEffect(() => {
    if (!transport.running) return;
    const timer = setInterval(() => {
      const time = now();
      commit(advanceFreeTransport(latest.current, time), time - lastSave.current >= 5000);
    }, 100);
    return () => clearInterval(timer);
  }, [transport.running, commit, now]);
  useEffect(
    () => () => {
      const next = updateFreeTransport(latest.current, now(), { running: false });
      latest.current = next;
      if (next.practice.activeMs > 0) change((d) => saveFreePractice(d, next.practice));
    },
    [change, now],
  );
  return { ...transport, setRunning, setPracticeMode, reset };
}
