import { useEffect, useRef, useState } from 'react';

/**
 * Focuses a field when it first appears, if asked to: the new definition or annotation a
 * selection-menu action just created (SELX-006, SELX-007, DEF-021).
 */
export function useFocusOnMount<T extends HTMLElement>(focus: boolean) {
  const ref = useRef<T>(null);
  // Only as the field appears: later renders must not steal focus back.
  const [initial] = useState(focus);
  useEffect(() => {
    if (initial) {
      ref.current?.focus({ preventScroll: true });
    }
  }, [initial]);
  return ref;
}
