import { useEffect, useState, type RefObject } from 'react';

export interface ViewportLines {
  /** The current line (RDR-030): first text node at or below the top bar. */
  top: string | undefined;
  /** The text node at the bottom of the viewport, for the map's viewport indicator. */
  bottom: string | undefined;
}

function nodeAt(x: number, y: number): string | undefined {
  // Probe a few points downwards in case y falls between lines.
  for (let dy = 0; dy <= 48; dy += 8) {
    const element = document.elementFromPoint(x, y + dy);
    const node = element?.closest<HTMLElement>('[data-node-id]');
    if (node?.dataset['nodeId']) {
      return node.dataset['nodeId'];
    }
  }
  return undefined;
}

/**
 * Tracks which text nodes are at the top and bottom of the viewport while scrolling, by probing
 * the element under a point in the text column (cheap: no per-node observers or measuring).
 */
export function useCurrentLine(
  textRef: RefObject<HTMLElement | null>,
  topOffset: () => number,
): ViewportLines {
  const [lines, setLines] = useState<ViewportLines>({ top: undefined, bottom: undefined });

  useEffect(() => {
    if (typeof document.elementFromPoint !== 'function') {
      return; // not available in tests
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = textRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const x = rect.left + Math.min(rect.width / 2, 240);
      const top = nodeAt(x, topOffset() + 2);
      const bottom = nodeAt(x, window.innerHeight - 56);
      setLines((previous) =>
        previous.top === top && previous.bottom === bottom ? previous : { top, bottom },
      );
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [textRef, topOffset]);

  return lines;
}
