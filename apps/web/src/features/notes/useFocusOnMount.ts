import { useEffect, useRef } from 'react';

/**
 * Focuses a field when it first appears, if asked to: the new definition or annotation a
 * selection-menu action just created (SELX-006, SELX-007, DEF-021).
 */
export function useFocusOnMount<T extends HTMLElement>(focus: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (focus) {
      ref.current?.focus({ preventScroll: true });
    }
    // Only on mount: later renders must not steal focus back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
