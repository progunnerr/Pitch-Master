import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import {
  decodePreferences,
  DEFAULT_PREFERENCES,
  encodePreferences,
  STORAGE_KEY,
  type Preferences,
} from './preferences';

function useStoredPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const latest = useRef(preferences);
  const hydrated = useRef(false);
  const mounted = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    latest.current = preferences;
  }, [preferences]);

  const save = useCallback(() => {
    if (!hydrated.current) return;
    const snapshot = encodePreferences(latest.current);
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot))
      .then(() => {
        if (mounted.current) setStorageError(null);
      })
      .catch(() => {
        if (mounted.current) setStorageError('Your settings could not be saved on this device.');
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setPreferences(decodePreferences(raw));
      })
      .catch(() => {
        if (!cancelled) setStorageError('Saved settings could not be read. Using defaults.');
      })
      .finally(() => {
        if (!cancelled) {
          hydrated.current = true;
          setReady(true);
        }
      });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') save();
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      save();
      subscription.remove();
    };
  }, [save]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(save, 200);
    return () => clearTimeout(timer);
  }, [preferences, ready, save]);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  return { preferences, update, ready, storageError, retrySave: save };
}

const PreferencesContext = createContext<ReturnType<typeof useStoredPreferences> | null>(null);

export function PreferencesProvider({ children }: PropsWithChildren) {
  const value = useStoredPreferences();
  return createElement(PreferencesContext.Provider, { value }, children);
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('Preferences require PreferencesProvider.');
  return value;
}
