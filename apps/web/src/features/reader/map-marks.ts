import type { VersionIndex } from '@shakespeer/corpus';
import type { AnnotationRecord } from '@shakespeer/storage';

/** Height of an annotation mark on the scene map, in CSS px. */
export const MARK_HEIGHT = 4;

export interface MarkGroup {
  top: number;
  annotations: AnnotationRecord[];
}

/**
 * Marks at each annotation's place in the play (MAP-041), merged where they would overlap so
 * the spot can be split by color (MAP-042).
 */
export function markGroups(
  index: VersionIndex,
  annotations: readonly AnnotationRecord[],
  barHeight: number,
): MarkGroup[] {
  const total = Math.max(1, index.nodes.length);
  const placed = annotations
    .flatMap((annotation) => {
      const at = index.indexOf(annotation.anchor.start.nodeId);
      return at === undefined ? [] : [{ top: (at / total) * barHeight, annotation }];
    })
    .sort((a, b) => a.top - b.top);
  const groups: MarkGroup[] = [];
  for (const { top, annotation } of placed) {
    const last = groups.at(-1);
    if (last && top - last.top < MARK_HEIGHT) {
      last.annotations.push(annotation);
    } else {
      groups.push({ top, annotations: [annotation] });
    }
  }
  return groups;
}
