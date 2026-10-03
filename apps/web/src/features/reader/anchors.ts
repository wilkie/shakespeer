/**
 * Anchors (specs/data/anchors.md): creating them from corpus positions, comparing them, and
 * resolving stored ones against the current text.
 */
import type { TextAnchor, VersionIndex } from '@shakespeer/corpus';

import type { Decoration } from './segments';

export interface Position {
  nodeId: string;
  offset: number;
}

const CONTEXT = 32;
const WORD = /[\p{L}\p{N}'’-]/u;
const TRIM = /[\s\p{P}]/u;

/** Orders positions in document order (ANC-003); undefined if a node is unknown. */
export function comparePositions(
  index: VersionIndex,
  a: Position,
  b: Position,
): number | undefined {
  const ia = index.indexOf(a.nodeId);
  const ib = index.indexOf(b.nodeId);
  if (ia === undefined || ib === undefined) {
    return undefined;
  }
  return ia === ib ? a.offset - b.offset : ia - ib;
}

/** The text between two positions, nodes joined by a newline (ANC-002). */
export function textBetween(
  index: VersionIndex,
  start: Position,
  end: Position,
): string | undefined {
  const from = index.indexOf(start.nodeId);
  const to = index.indexOf(end.nodeId);
  if (from === undefined || to === undefined || from > to) {
    return undefined;
  }
  const parts: string[] = [];
  for (let i = from; i <= to; i += 1) {
    const text = index.nodes[i]?.text ?? '';
    parts.push(text.slice(i === from ? start.offset : 0, i === to ? end.offset : text.length));
  }
  return parts.join('\n');
}

/**
 * Snaps a range outward to whole words, then trims whitespace and punctuation from both ends
 * (SELX-005). Returns undefined if nothing is left.
 */
export function snapToWords(
  index: VersionIndex,
  start: Position,
  end: Position,
): { start: Position; end: Position } | undefined {
  let from = index.indexOf(start.nodeId);
  let to = index.indexOf(end.nodeId);
  if (from === undefined || to === undefined) {
    return undefined;
  }
  let startOffset = start.offset;
  let endOffset = end.offset;

  // Outward to word boundaries.
  const startText = index.nodes[from]?.text ?? '';
  while (
    startOffset > 0 &&
    WORD.test(startText[startOffset - 1] ?? '') &&
    WORD.test(startText[startOffset] ?? '')
  ) {
    startOffset -= 1;
  }
  const endText = index.nodes[to]?.text ?? '';
  while (
    endOffset < endText.length &&
    WORD.test(endText[endOffset] ?? '') &&
    WORD.test(endText[endOffset - 1] ?? '')
  ) {
    endOffset += 1;
  }

  // Inward past whitespace and punctuation, crossing node boundaries as needed.
  for (;;) {
    const text = index.nodes[from]?.text ?? '';
    while (startOffset < text.length && TRIM.test(text[startOffset] ?? '')) {
      startOffset += 1;
    }
    if (startOffset < text.length || from >= to) {
      break;
    }
    from += 1;
    startOffset = 0;
  }
  for (;;) {
    const text = index.nodes[to]?.text ?? '';
    while (endOffset > 0 && TRIM.test(text[endOffset - 1] ?? '')) {
      endOffset -= 1;
    }
    if (endOffset > 0 || to <= from) {
      break;
    }
    to -= 1;
    endOffset = index.nodes[to]?.text.length ?? 0;
  }
  if (from > to || (from === to && endOffset <= startOffset)) {
    return undefined;
  }
  return {
    start: { nodeId: index.nodes[from]?.id ?? '', offset: startOffset },
    end: { nodeId: index.nodes[to]?.id ?? '', offset: endOffset },
  };
}

/** A complete anchor for a range of the current text (ANC-002). */
export function makeAnchor(
  index: VersionIndex,
  start: Position,
  end: Position,
): TextAnchor | undefined {
  const exact = textBetween(index, start, end);
  if (!exact) {
    return undefined;
  }
  const startText = index.node(start.nodeId)?.text ?? '';
  const endText = index.node(end.nodeId)?.text ?? '';
  return {
    start,
    end,
    quote: {
      exact,
      prefix: startText.slice(Math.max(0, start.offset - CONTEXT), start.offset),
      suffix: endText.slice(end.offset, end.offset + CONTEXT),
    },
    revision: index.doc.revision,
  };
}

/** Anchors are equal when they start and end at the same places (ANC-010). */
export function anchorsEqual(a: TextAnchor, b: TextAnchor): boolean {
  return (
    a.start.nodeId === b.start.nodeId &&
    a.start.offset === b.start.offset &&
    a.end.nodeId === b.end.nodeId &&
    a.end.offset === b.end.offset
  );
}

/** A key identifying an anchor's span, equal for equal anchors. */
export function anchorKey(anchor: TextAnchor): string {
  return `${anchor.start.nodeId}:${String(anchor.start.offset)}-${anchor.end.nodeId}:${String(anchor.end.offset)}`;
}

/** Whether the anchor covers the character at a position (ANC-011). */
export function covers(index: VersionIndex, anchor: TextAnchor, point: Position): boolean {
  const afterStart = comparePositions(index, anchor.start, point);
  const beforeEnd = comparePositions(index, point, anchor.end);
  return afterStart !== undefined && beforeEnd !== undefined && afterStart <= 0 && beforeEnd < 0;
}

/** Per-node ranges of an anchor, for rendering (ANC-004: a span may cross nodes). */
export function decorationsFor(
  index: VersionIndex,
  anchor: TextAnchor,
  id: string,
): [string, Decoration][] {
  const from = index.indexOf(anchor.start.nodeId);
  const to = index.indexOf(anchor.end.nodeId);
  if (from === undefined || to === undefined) {
    return [];
  }
  const result: [string, Decoration][] = [];
  for (let i = from; i <= to; i += 1) {
    const node = index.nodes[i];
    if (!node) {
      continue;
    }
    const start = i === from ? anchor.start.offset : 0;
    const end = i === to ? anchor.end.offset : node.text.length;
    if (end > start) {
      result.push([node.id, { start, end, id }]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Resolution (ANC-030 – ANC-032)

export type Resolution =
  | { status: 'valid'; anchor: TextAnchor }
  | { status: 'repaired'; anchor: TextAnchor }
  | { status: 'unattached' };

interface FlatText {
  text: string;
  /** Offset of each node's text in `text`. */
  starts: number[];
}

const flatTexts = new WeakMap<VersionIndex, FlatText>();

/** The whole version as one string, nodes joined by newlines, with node offsets. */
function flatText(index: VersionIndex): FlatText {
  let flat = flatTexts.get(index);
  if (!flat) {
    const starts: number[] = [];
    let length = 0;
    for (const node of index.nodes) {
      starts.push(length);
      length += node.text.length + 1;
    }
    flat = { text: index.nodes.map((node) => node.text).join('\n'), starts };
    flatTexts.set(index, flat);
  }
  return flat;
}

function positionAt(index: VersionIndex, flat: FlatText, offset: number): Position {
  let low = 0;
  let high = flat.starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((flat.starts[mid] ?? 0) <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { nodeId: index.nodes[low]?.id ?? '', offset: offset - (flat.starts[low] ?? 0) };
}

function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) {
    n += 1;
  }
  return n;
}

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) {
    n += 1;
  }
  return n;
}

/**
 * Checks a stored anchor against the current text (ANC-030); if the text moved, finds the
 * quote again, preferring the occurrence whose surroundings agree best and which is unique
 * (ANC-031); otherwise the note is unattached (ANC-032).
 */
export function resolveAnchor(index: VersionIndex, anchor: TextAnchor): Resolution {
  if (textBetween(index, anchor.start, anchor.end) === anchor.quote.exact) {
    return { status: 'valid', anchor };
  }
  const flat = flatText(index);
  const { exact, prefix, suffix } = anchor.quote;
  const candidates: { at: number; score: number }[] = [];
  for (let at = flat.text.indexOf(exact); at >= 0; at = flat.text.indexOf(exact, at + 1)) {
    const before = flat.text.slice(Math.max(0, at - prefix.length), at);
    const after = flat.text.slice(at + exact.length, at + exact.length + suffix.length);
    candidates.push({ at, score: commonSuffix(before, prefix) + commonPrefix(after, suffix) });
  }
  candidates.sort((a, b) => b.score - a.score);
  const [best, second] = candidates;
  if (!best || second?.score === best.score) {
    return { status: 'unattached' };
  }
  const start = positionAt(index, flat, best.at);
  const end = positionAt(index, flat, best.at + exact.length);
  return {
    status: 'repaired',
    anchor: { ...anchor, start, end, revision: index.doc.revision },
  };
}
