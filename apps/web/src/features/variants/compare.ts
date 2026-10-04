/**
 * The rows of the comparison view (VAR-021): text of the current version and the compared one
 * that corresponds, matched through each version's alignment to the modern version (CRP-050),
 * which composes when both are original versions.
 */
import { wordKey, wordSpans, type AlignmentFile, type VersionIndex } from '@shakespeer/corpus';

/** One side of the comparison: a version, and its alignment unless it is the modern one. */
export interface CompareSide {
  index: VersionIndex;
  alignment: AlignmentFile | undefined;
}

export interface CompareRow {
  /** Current-version nodes; empty where only the compared version has text. */
  left: string[];
  /** Compared-version nodes; empty where it has nothing that corresponds. */
  right: string[];
  /** Whether the compared text comes from elsewhere in its own version (moved, reordered). */
  rightMoved: boolean;
}

/**
 * A version's text as units in its own order, each with the modern nodes it corresponds to:
 * consecutive nodes of one alignment entry form a unit.
 */
function units(side: CompareSide): { nodes: string[]; modern: string[] }[] {
  const { alignment } = side;
  if (!alignment) {
    return side.index.nodes.map((node) => ({ nodes: [node.id], modern: [node.id] }));
  }
  const entryOf = new Map<string, AlignmentFile['entries'][number]>();
  for (const entry of alignment.entries) {
    for (const id of entry.orig) {
      entryOf.set(id, entry);
    }
  }
  const result: { nodes: string[]; modern: string[] }[] = [];
  let previous: AlignmentFile['entries'][number] | undefined;
  for (const node of side.index.nodes) {
    const entry = entryOf.get(node.id);
    const last = result.at(-1);
    if (last && entry && entry === previous) {
      last.nodes.push(node.id);
    } else {
      result.push({ nodes: [node.id], modern: entry?.modern ?? [] });
    }
    previous = entry;
  }
  return result;
}

/**
 * Rows in the current version's order. Each compared node goes to the first row whose modern
 * counterparts it shares; compared text with no counterpart goes after the row holding the
 * compared text before it.
 */
export function compareRows(left: CompareSide, right: CompareSide): CompareRow[] {
  const rightUnits = units(right);
  const rightByModern = new Map<string, string[]>();
  for (const unit of rightUnits) {
    for (const m of unit.modern) {
      rightByModern.set(m, [...(rightByModern.get(m) ?? []), ...unit.nodes]);
    }
  }
  const rightOrder = (id: string) => right.index.indexOf(id) ?? 0;
  const assigned = new Set<string>();
  const rows: CompareRow[] = [];
  for (const unit of units(left)) {
    const nodes = unit.modern
      .flatMap((m) => rightByModern.get(m) ?? [])
      .filter((id) => !assigned.has(id));
    const rightNodes = [...new Set(nodes)].sort((a, b) => rightOrder(a) - rightOrder(b));
    rightNodes.forEach((id) => assigned.add(id));
    rows.push({ left: unit.nodes, right: rightNodes, rightMoved: false });
  }

  // Compared text nobody claimed: after the row with the compared node before it.
  const rowOf = new Map<string, number>();
  rows.forEach((row, i) => {
    row.right.forEach((id) => rowOf.set(id, i));
  });
  const inserts = new Map<number, string[]>();
  let lastRow = -1;
  for (const node of right.index.nodes) {
    const at = rowOf.get(node.id);
    if (at !== undefined) {
      lastRow = at;
    } else {
      inserts.set(lastRow, [...(inserts.get(lastRow) ?? []), node.id]);
    }
  }
  const result: CompareRow[] = [];
  const pushInserted = (after: number) => {
    const ids = inserts.get(after);
    if (ids) {
      // Consecutive compared nodes share a row.
      let run: string[] = [];
      ids.forEach((id, i) => {
        const previous = ids[i - 1];
        if (previous !== undefined && rightOrder(id) !== rightOrder(previous) + 1) {
          result.push({ left: [], right: run, rightMoved: false });
          run = [];
        }
        run.push(id);
      });
      result.push({ left: [], right: run, rightMoved: false });
    }
  };
  pushInserted(-1);
  rows.forEach((row, i) => {
    result.push(row);
    pushInserted(i);
  });

  // Compared text that goes backwards in its own version came from elsewhere (VAR-021).
  let furthest = -1;
  for (const row of result) {
    const first = row.right[0];
    if (first === undefined) {
      continue;
    }
    const position = rightOrder(first);
    row.rightMoved = position < furthest;
    furthest = Math.max(furthest, rightOrder(row.right.at(-1) ?? first));
  }
  return result;
}

/** A range of a text that differs from the other side of its row (VAR-023). */
export interface DiffRange {
  start: number;
  end: number;
}

/**
 * The words of each side that the other lacks, by a longest common subsequence of words.
 * Words are compared by spelling-insensitive key unless `exact` (VAR-023).
 */
export function diffWords(
  leftText: string,
  rightText: string,
  exact: boolean,
): { left: DiffRange[]; right: DiffRange[] } {
  // "&" is "and", as the aligner reads it.
  const key = (word: string) =>
    word === '&'
      ? 'and'
      : exact
        ? word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
        : wordKey(word);
  const a = wordSpans(leftText).filter((w) => key(w.word) !== '');
  const b = wordSpans(rightText).filter((w) => key(w.word) !== '');
  const n = a.length;
  const m = b.length;
  // LCS table, rows of b-length + 1.
  const table = new Array<number>((n + 1) * (m + 1)).fill(0);
  const at = (i: number, j: number) => table[i * (m + 1) + j] ?? 0;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * (m + 1) + j] =
        key(a[i]?.word ?? '') === key(b[j]?.word ?? '')
          ? at(i + 1, j + 1) + 1
          : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const left: DiffRange[] = [];
  const right: DiffRange[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const wa = a[i];
    const wb = b[j];
    if (wa && wb && key(wa.word) === key(wb.word)) {
      i += 1;
      j += 1;
    } else if (wb && (!wa || at(i, j + 1) >= at(i + 1, j))) {
      right.push({ start: wb.start, end: wb.end });
      j += 1;
    } else if (wa) {
      left.push({ start: wa.start, end: wa.end });
      i += 1;
    }
  }
  return { left, right };
}
