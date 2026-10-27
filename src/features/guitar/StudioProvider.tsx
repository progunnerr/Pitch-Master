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
import { decodeStudio, emptyStudio, GUITAR_STORAGE_KEY, type StudioData } from './storage';

let writes = Promise.resolve();
function useStudioStorage() {
  const [data, setData] = useState<StudioData>(emptyStudio);
  const current = useRef<StudioData | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const save = useCallback((snapshot: StudioData) => {
    const encoded = JSON.stringify(snapshot);
    writes = writes
      .then(() => AsyncStorage.setItem(GUITAR_STORAGE_KEY, encoded))
      .then(() => {
        if (mounted.current) setError(null);
      })
      .catch(() => {
        if (mounted.current)
          setError('Your studio changes are in memory but could not be saved. Retry saving.');
      });
  }, []);
  const load = useCallback(() => {
    writes
      .then(() => AsyncStorage.getItem(GUITAR_STORAGE_KEY))
      .then((raw) => {
        const restored = decodeStudio(raw);
        if (!mounted.current) return;
        current.current = restored;
        setData(restored);
        setReady(true);
        setError(null);
      })
      .catch(() => {
        if (mounted.current)
          setError('Could not read your saved studio. Retry loading to protect your data.');
      });
  }, []);
  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);
  const change = useCallback(
    (update: (data: StudioData) => StudioData) => {
      if (!current.current) return;
      const next = update(current.current);
      current.current = next;
      setData(next);
      save(next);
    },
    [save],
  );
  const retry = useCallback(() => {
    if (current.current) save(current.current);
    else load();
  }, [load, save]);
  return { data, ready, error, change, retry };
}
const StudioContext = createContext<ReturnType<typeof useStudioStorage> | null>(null);
export function StudioProvider({ children }: { children: ReactNode }) {
  const studio = useStudioStorage();
  return <StudioContext.Provider value={studio}>{children}</StudioContext.Provider>;
}
export function useStudio() {
  const studio = useContext(StudioContext);
  if (!studio) throw new Error('Guitar studio requires StudioProvider.');
  return studio;
}
