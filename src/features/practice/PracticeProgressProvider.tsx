import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import {
  decodeProgress,
  emptyProgress,
  PROGRESS_KEY,
  recordResult,
  type PracticeProgress,
  type RoundResult,
} from './progress';

// Re-entry waits for writes from an earlier provider instance before reading a snapshot.
let writes = Promise.resolve();
function useProgressStorage() {
  const [progress, setProgress] = useState(emptyProgress);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<PracticeProgress | null>(null);
  const dirty = useRef(false);
  const mounted = useRef(false);

  const load = useCallback(() => {
    writes
      .then(() => AsyncStorage.getItem(PROGRESS_KEY))
      .then((raw) => {
        if (!mounted.current) return;
        const restored = decodeProgress(raw);
        current.current = restored;
        setProgress(restored);
        setReady(true);
        setError(null);
      })
      .catch(() => {
        if (mounted.current)
          setError('Could not load saved progress. Retry before starting practice.');
      });
  }, []);

  const save = useCallback((snapshot: PracticeProgress) => {
    const encoded = JSON.stringify(snapshot);
    writes = writes
      .then(() => AsyncStorage.setItem(PROGRESS_KEY, encoded))
      .then(() => {
        if (current.current === snapshot) dirty.current = false;
        if (mounted.current) setError(null);
      })
      .catch(() => {
        if (mounted.current)
          setError('Progress is kept for this session, but could not be saved. Tap Retry saving.');
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && dirty.current && current.current) save(current.current);
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      if (dirty.current && current.current) save(current.current);
    };
  }, [load, save]);

  const record = useCallback(
    (result: RoundResult) => {
      if (!current.current) return;
      const next = recordResult(current.current, result);
      if (next === current.current) return;
      current.current = next;
      dirty.current = true;
      setProgress(next);
      save(next);
    },
    [save],
  );

  const retry = useCallback(() => {
    if (current.current) save(current.current);
    else load();
  }, [load, save]);
  return { progress, ready, error, record, retry };
}

const PracticeProgressContext = createContext<ReturnType<typeof useProgressStorage> | null>(null);
export function PracticeProgressProvider({ children }: { children: ReactNode }) {
  const store = useProgressStorage();
  return (
    <PracticeProgressContext.Provider value={store}>{children}</PracticeProgressContext.Provider>
  );
}
export function usePracticeProgress() {
  const store = useContext(PracticeProgressContext);
  if (!store) throw new Error('Practice progress requires PracticeProgressProvider.');
  return store;
}
