import { useEffect, useRef, useState } from 'react';

/**
 * Local draft state that saves itself (PNL-022): `delay` ms after the last change, immediately
 * on `flush` (call it when a field loses focus), and on unmount.
 */
export function useAutosave<T>(
  initial: T,
  save: (value: T) => void,
  delay = 500,
): [value: T, update: (next: T) => void, flush: () => void] {
  const [value, setValue] = useState(initial);
  const pending = useRef<{ timer: number; value: T } | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const flush = () => {
    const current = pending.current;
    if (current) {
      window.clearTimeout(current.timer);
      pending.current = null;
      saveRef.current(current.value);
    }
  };

  const update = (next: T) => {
    setValue(next);
    if (pending.current) {
      window.clearTimeout(pending.current.timer);
    }
    pending.current = {
      value: next,
      timer: window.setTimeout(() => {
        pending.current = null;
        saveRef.current(next);
      }, delay),
    };
  };

  useEffect(
    () => () => {
      const current = pending.current;
      if (current) {
        window.clearTimeout(current.timer);
        pending.current = null;
        saveRef.current(current.value);
      }
    },
    [],
  );

  return [value, update, flush];
}
