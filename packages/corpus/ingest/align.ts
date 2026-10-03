/**
 * Aligns an original version to the modern version (CRP-050, CRP-051).
 *
 * Within each pair of corresponding scenes, both texts become streams of spelling-normalized
 * word tokens (stage directions and spoken text kept apart). A longest-common-subsequence pass
 * matches tokens; nodes connected by matched tokens form one alignment entry. An entry is `same`
 * when every word on both sides is matched (allowing small spelling differences), otherwise
 * `variant`; nodes with no matched words are `orig-only` / `modern-only`.
 */
import type { AlignmentEntry, Scene, TextNode, VersionDocument } from '../src/schema.ts';

interface Token {
  key: string;
  nodeIndex: number;
}

/**
 * A spelling-insensitive key for an early modern or modern word: u/v, i/j and y/i are
 * interchangeable, doubled letters and a final e are dropped ("heere" ~ "here", "haue" ~ "have").
 */
export function wordKey(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('ſ', 's')
    .replaceAll('v', 'u')
    .replaceAll('j', 'i')
    .replaceAll('y', 'i')
    .replace(/[^a-z]/g, '')
    .replaceAll('ck', 'c') // "musicke" ~ "music"
    .replace(/(.)\1+/g, '$1')
    .replace(/(.)e$/, '$1')
    .replace(/(..)ed$/, '$1d') // "stopped" ~ "stopp'd"
    .replace(/([pkcsx])t$/, '$1d'); // "stopt" ~ "stopped", "kist" ~ "kissed"
}

function words(text: string): string[] {
  return text
    .replaceAll('&', ' and ')
    .split(/[\s—–-]+/)
    .map(wordKey)
    .filter((key) => key !== '');
}

function tokenize(nodes: TextNode[]): Token[] {
  return nodes.flatMap((node, nodeIndex) =>
    words(node.text).map((key) => ({ key: `${node.kind}:${key}`, nodeIndex })),
  );
}

/** Index pairs of a longest common subsequence of two key sequences. */
function lcs(a: string[], b: string[]): [number, number][] {
  const width = b.length + 1;
  const table = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j] ?? 0;
      row[j] = Math.min(
        above + 1,
        (row[j - 1] ?? 0) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return row[b.length] ?? 0;
}

/** Whether two word sequences are equal allowing small spelling differences per word. */
function equivalent(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((word, i) => {
    const other = b[i] ?? '';
    return (
      word === other ||
      editDistance(word, other) <= Math.ceil(Math.max(word.length, other.length) / 3)
    );
  });
}

function sceneNodes(scene: Scene): TextNode[] {
  return scene.blocks.flatMap((block) => (block.type === 'speech' ? block.nodes : [block.node]));
}

function alignScene(orig: TextNode[], modern: TextNode[]): AlignmentEntry[] {
  const origTokens = tokenize(orig);
  const modernTokens = tokenize(modern);
  const pairs = lcs(
    origTokens.map((t) => t.key),
    modernTokens.map((t) => t.key),
  );

  // Union-find over nodes of both sides: orig nodes 0..n-1, modern nodes n..n+m-1.
  const parent = Array.from({ length: orig.length + modern.length }, (_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) {
      root = parent[root] ?? root;
    }
    parent[x] = root;
    return root;
  };
  const linked = new Set<number>();
  for (const [i, j] of pairs) {
    const a = origTokens[i]?.nodeIndex ?? 0;
    const b = orig.length + (modernTokens[j]?.nodeIndex ?? 0);
    linked.add(a);
    linked.add(b);
    parent[find(a)] = find(b);
  }

  // Group in document order of the original, interleaving unmatched modern nodes in place.
  const groups = new Map<number, { orig: number[]; modern: number[] }>();
  for (let index = 0; index < parent.length; index += 1) {
    if (!linked.has(index)) {
      continue;
    }
    const root = find(index);
    const group = groups.get(root) ?? { orig: [], modern: [] };
    if (index < orig.length) {
      group.orig.push(index);
    } else {
      group.modern.push(index - orig.length);
    }
    groups.set(root, group);
  }

  const entries: { position: [number, number]; entry: AlignmentEntry }[] = [];
  for (const { orig: o, modern: m } of groups.values()) {
    const origWords = o.flatMap((i) => words(orig[i]?.text ?? ''));
    const modernWords = m.flatMap((i) => words(modern[i]?.text ?? ''));
    entries.push({
      position: [o[0] ?? 0, m[0] ?? 0],
      entry: {
        orig: o.map((i) => orig[i]?.id ?? ''),
        modern: m.map((i) => modern[i]?.id ?? ''),
        relation: equivalent(origWords, modernWords) ? 'same' : 'variant',
        status: 'auto',
      },
    });
  }
  orig.forEach((node, i) => {
    if (!linked.has(i)) {
      // Place after the entry containing the previous original node.
      entries.push({
        position: [i, -1],
        entry: { orig: [node.id], modern: [], relation: 'orig-only', status: 'auto' },
      });
    }
  });
  modern.forEach((node, j) => {
    if (!linked.has(orig.length + j)) {
      entries.push({
        position: [-1, j],
        entry: { orig: [], modern: [node.id], relation: 'modern-only', status: 'auto' },
      });
    }
  });

  // Order: by original position where known; modern-only entries by the modern position of
  // the entry they follow.
  const known = entries
    .filter((e) => e.position[0] >= 0)
    .sort((a, b) => a.position[0] - b.position[0]);
  const result: AlignmentEntry[] = [];
  const modernOnly = entries
    .filter((e) => e.position[0] < 0)
    .sort((a, b) => a.position[1] - b.position[1]);
  let nextModernOnly = 0;
  for (const { position, entry } of known) {
    while (
      nextModernOnly < modernOnly.length &&
      entry.modern.length > 0 &&
      (modernOnly[nextModernOnly]?.position[1] ?? Infinity) < position[1]
    ) {
      result.push((modernOnly[nextModernOnly] as (typeof modernOnly)[number]).entry);
      nextModernOnly += 1;
    }
    result.push(entry);
  }
  for (; nextModernOnly < modernOnly.length; nextModernOnly += 1) {
    result.push((modernOnly[nextModernOnly] as (typeof modernOnly)[number]).entry);
  }
  return result;
}

/** Scenes of a version in order. */
function scenes(doc: Pick<VersionDocument, 'divisions'>): Scene[] {
  return doc.divisions.flatMap((act) => act.scenes);
}

/**
 * Aligns scene by scene. Scenes correspond by position; the two versions must have the same
 * scene sequence (versions with different scene orders, like Q1 Hamlet, need a scene map).
 */
export function alignVersions(
  orig: Pick<VersionDocument, 'divisions'>,
  modern: Pick<VersionDocument, 'divisions'>,
): AlignmentEntry[] {
  const origScenes = scenes(orig);
  const modernScenes = scenes(modern);
  const describe = (list: Scene[]) => list.map((s) => `${s.kind}:${String(s.n)}`).join(' ');
  if (describe(origScenes) !== describe(modernScenes)) {
    throw new Error(
      `Scene structures differ; a scene map is needed.\n  orig:   ${describe(origScenes)}\n  modern: ${describe(modernScenes)}`,
    );
  }
  return origScenes.flatMap((scene, i) =>
    alignScene(sceneNodes(scene), sceneNodes(modernScenes[i] as Scene)),
  );
}
