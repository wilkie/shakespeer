import { useEffect, useState } from 'react';

import { getSettings, type Settings } from '@/lib/storage';

type Listener = (value: unknown) => void;

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();

function publish(key: string, value: unknown) {
  cache.set(key, value);
  for (const listener of listeners.get(key) ?? []) {
    listener(value);
  }
}

/** Writes a setting and updates every component using it. */
export async function setSetting<K extends keyof Settings & string>(
  key: K,
  value: Settings[K],
): Promise<void> {
  publish(key, value);
  await (await getSettings()).set(key, value);
}

/** Reads a persisted setting, re-rendering when it changes anywhere in the app. */
export function useSetting<K extends keyof Settings & string>(
  key: K,
  fallback: Settings[K],
): [Settings[K], (value: Settings[K]) => void] {
  const [value, setValue] = useState<unknown>(() => (cache.has(key) ? cache.get(key) : fallback));

  useEffect(() => {
    const listener: Listener = (next) => {
      setValue(next);
    };
    const set = listeners.get(key) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(key, set);
    if (!cache.has(key)) {
      void getSettings()
        .then((settings) => settings.get(key))
        .then((stored) => {
          if (stored !== undefined && !cache.has(key)) {
            publish(key, stored);
          }
        });
    }
    return () => {
      set.delete(listener);
    };
  }, [key]);

  return [
    value ?? fallback,
    (next) => {
      void setSetting(key, next);
    },
  ];
}
