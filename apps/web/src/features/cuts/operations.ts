/**
 * Editing a cut's operations (CUT-031 – CUT-034). Each function returns a new list; the caller
 * saves it and keeps the old one for undo (CUT-030).
 */
import type { TextAnchor, VersionIndex } from '@shakespeer/corpus';
import type { CutOperation } from '@shakespeer/storage';

import { comparePositions, makeAnchor, type Position } from '@/features/reader/anchors';

const newId = () => crypto.randomUUID();

function overlaps(index: VersionIndex, anchor: TextAnchor, start: Position, end: Position) {
  // Touching spans count, so adjacent cuts merge into one.
  const a = comparePositions(index, anchor.start, end);
  const b = comparePositions(index, start, anchor.end);
  return a !== undefined && b !== undefined && a <= 0 && b <= 0;
}

function strictlyOverlaps(index: VersionIndex, anchor: TextAnchor, start: Position, end: Position) {
  const a = comparePositions(index, anchor.start, end);
  const b = comparePositions(index, start, anchor.end);
  return a !== undefined && b !== undefined && a < 0 && b < 0;
}

const earlier = (index: VersionIndex, a: Position, b: Position) =>
  (comparePositions(index, a, b) ?? 0) <= 0 ? a : b;
const later = (index: VersionIndex, a: Position, b: Position) =>
  (comparePositions(index, a, b) ?? 0) >= 0 ? a : b;

/**
 * Hides a span. Cuts and replacements it overlaps or touches merge into one cut span
 * (CUT-034).
 */
export function hideSpan(
  index: VersionIndex,
  operations: readonly CutOperation[],
  start: Position,
  end: Position,
): CutOperation[] {
  let from = start;
  let to = end;
  const kept: CutOperation[] = [];
  for (const op of operations) {
    if (op.type !== 'insert' && overlaps(index, op.anchor, start, end)) {
      from = earlier(index, from, op.anchor.start);
      to = later(index, to, op.anchor.end);
    } else {
      kept.push(op);
    }
  }
  const anchor = makeAnchor(index, from, to);
  return anchor ? [...kept, { id: newId(), type: 'hide', anchor }] : [...operations];
}

/** Whether a span can be given new wording: not where text is cut or already replaced (CUT-034). */
export function canReplace(
  index: VersionIndex,
  operations: readonly CutOperation[],
  start: Position,
  end: Position,
): boolean {
  return !operations.some(
    (op) => op.type !== 'insert' && strictlyOverlaps(index, op.anchor, start, end),
  );
}

export function replaceSpan(
  index: VersionIndex,
  operations: readonly CutOperation[],
  start: Position,
  end: Position,
  text: string,
): CutOperation[] {
  const anchor = makeAnchor(index, start, end);
  return anchor && canReplace(index, operations, start, end)
    ? [...operations, { id: newId(), type: 'replace', anchor, text }]
    : [...operations];
}

export function insertAfter(
  operations: readonly CutOperation[],
  after: string,
  kind: 'sd' | 'narration',
  text: string,
): CutOperation[] {
  return [...operations, { id: newId(), type: 'insert', after, kind, text }];
}

/** Removes a change (CUT-033: Restore). */
export function removeOperation(operations: readonly CutOperation[], opId: string): CutOperation[] {
  return operations.filter((op) => op.id !== opId);
}

/** Changes a replacement's or insertion's wording (CUT-033: Edit). */
export function editOperationText(
  operations: readonly CutOperation[],
  opId: string,
  text: string,
): CutOperation[] {
  return operations.map((op) => (op.id === opId && op.type !== 'hide' ? { ...op, text } : op));
}

/** The span of whole nodes `from`…`to` (sequence indexes, inclusive). */
export function nodeSpan(
  index: VersionIndex,
  from: number,
  to: number,
): { start: Position; end: Position } | undefined {
  const first = index.nodes[from];
  const last = index.nodes[to];
  return first && last
    ? { start: { nodeId: first.id, offset: 0 }, end: { nodeId: last.id, offset: last.text.length } }
    : undefined;
}

/**
 * Restores whole nodes `from`…`to` (CUT-032: Restore scene): cuts and replacements within them
 * are removed, and cut spans reaching outside keep only their parts outside.
 */
export function restoreNodes(
  index: VersionIndex,
  operations: readonly CutOperation[],
  from: number,
  to: number,
): CutOperation[] {
  const span = nodeSpan(index, from, to);
  if (!span) {
    return [...operations];
  }
  const result: CutOperation[] = [];
  for (const op of operations) {
    if (op.type === 'insert' || !strictlyOverlaps(index, op.anchor, span.start, span.end)) {
      result.push(op);
      continue;
    }
    if (op.type === 'replace') {
      continue;
    }
    const opFrom = index.indexOf(op.anchor.start.nodeId) ?? 0;
    const opTo = index.indexOf(op.anchor.end.nodeId) ?? 0;
    if (opFrom < from) {
      const before = index.nodes[from - 1];
      const anchor =
        before &&
        makeAnchor(index, op.anchor.start, { nodeId: before.id, offset: before.text.length });
      if (anchor) {
        result.push({ id: newId(), type: 'hide', anchor });
      }
    }
    if (opTo > to) {
      const after = index.nodes[to + 1];
      const anchor = after && makeAnchor(index, { nodeId: after.id, offset: 0 }, op.anchor.end);
      if (anchor) {
        result.push({ id: newId(), type: 'hide', anchor });
      }
    }
  }
  return result;
}
