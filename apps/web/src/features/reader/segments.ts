import type { Mark, MarkType } from '@shakespeer/corpus';

/** A range of a node's text that carries note references (e.g. definition terms). */
export interface Decoration {
  start: number;
  end: number;
  id: string;
}

export interface Segment {
  text: string;
  start: number;
  end: number;
  marks: MarkType[];
  /** IDs of decorations covering this segment. */
  ids: string[];
}

/**
 * Splits a text node into runs with uniform marks and decorations, so each run renders as one
 * element and character offsets stay exact (ANC-020).
 */
export function segmentText(
  text: string,
  marks: readonly Mark[] = [],
  decorations: readonly Decoration[] = [],
): Segment[] {
  const cuts = new Set([0, text.length]);
  for (const range of [...marks, ...decorations]) {
    cuts.add(Math.max(0, Math.min(text.length, range.start)));
    cuts.add(Math.max(0, Math.min(text.length, range.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i] ?? 0;
    const end = points[i + 1] ?? 0;
    if (end <= start) {
      continue;
    }
    segments.push({
      text: text.slice(start, end),
      start,
      end,
      marks: marks.filter((m) => m.start <= start && m.end >= end).map((m) => m.type),
      ids: decorations.filter((d) => d.start <= start && d.end >= end).map((d) => d.id),
    });
  }
  return segments;
}
