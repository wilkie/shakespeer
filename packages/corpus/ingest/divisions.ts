/**
 * Editorial divisions (CRP-031): where an original version prints fewer act or scene divisions
 * than the modern one (the First Folio's Hamlet stops dividing in Act 2, its Troilus after the
 * first heading), its long printed scenes are split where the modern scenes begin, found
 * through the text itself, and the added divisions are flagged `editorial: true`.
 */
import type { Act, Block, Scene, TextNode, VersionDocument } from '../src/schema.ts';
import { wordKey } from './align.ts';
import { modernCounterparts, placed, sceneKey, type Placed } from './scenes.ts';

function blockNodes(block: Block): TextNode[] {
  return block.type === 'speech' ? block.nodes : [block.node];
}

function blockWords(block: Block): string[] {
  return blockNodes(block)
    .flatMap((node) => node.text.replaceAll('&', ' and ').split(/[\s—–-]+/))
    .map(wordKey)
    .filter((key) => key !== '');
}

const GRAM = 5;

/**
 * Pairs of positions (orig, modern) where the same five words occur exactly once on each side,
 * reduced to the longest chain increasing on both: reliable landmarks in two long texts.
 */
function anchors(orig: string[], modern: string[]): [number, number][] {
  const grams = (words: string[]) => {
    const seen = new Map<string, number>();
    for (let i = 0; i + GRAM <= words.length; i += 1) {
      const gram = words.slice(i, i + GRAM).join(' ');
      seen.set(gram, seen.has(gram) ? -1 : i);
    }
    return seen;
  };
  const a = grams(orig);
  const b = grams(modern);
  const pairs: [number, number][] = [];
  for (const [gram, i] of a) {
    const j = b.get(gram);
    if (i >= 0 && j !== undefined && j >= 0) {
      pairs.push([i, j]);
    }
  }
  pairs.sort((x, y) => x[1] - y[1]);
  // Longest chain increasing in orig position (patience sorting).
  const tails: number[] = [];
  const previous = new Array<number>(pairs.length).fill(-1);
  pairs.forEach(([i], k) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((pairs[tails[mid] ?? 0]?.[0] ?? 0) < i) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    previous[k] = low > 0 ? (tails[low - 1] ?? -1) : -1;
    tails[low] = k;
  });
  const chain: [number, number][] = [];
  for (let k = tails.at(-1) ?? -1; k >= 0; k = previous[k] ?? -1) {
    chain.push(pairs[k] as [number, number]);
  }
  return chain.reverse();
}

/** The orig word position matching a modern one, interpolated between the nearest anchors. */
function origPosition(chain: [number, number][], modern: number): number {
  let before: [number, number] = [0, 0];
  let after: [number, number] | undefined;
  for (const pair of chain) {
    if (pair[1] <= modern) {
      before = pair;
    } else {
      after = pair;
      break;
    }
  }
  if (!after || after[1] === before[1]) {
    return before[0] + (modern - before[1]);
  }
  const fraction = (modern - before[1]) / (after[1] - before[1]);
  return Math.round(before[0] + fraction * (after[0] - before[0]));
}

/** How many words nearer a plain block boundary must be to win over an entrance. */
const ENTRANCE_PREFERENCE = 40;

const isEntrance = (block: Block) => block.type === 'sd' && /\benter\b/i.test(block.node.text);

/**
 * Splits one printed scene's blocks into pieces, one per modern scene it spans. Each cut falls
 * at a block boundary, preferring an entrance near where the modern scene starts.
 */
function split(blocks: Block[], modernScenes: Scene[]): Block[][] {
  const starts: number[] = []; // word position at which each block starts
  const origWords: string[] = [];
  for (const block of blocks) {
    starts.push(origWords.length);
    origWords.push(...blockWords(block));
  }
  const modernWords: string[] = [];
  const modernStarts: number[] = [];
  for (const scene of modernScenes) {
    modernStarts.push(modernWords.length);
    modernWords.push(...scene.blocks.flatMap(blockWords));
  }
  const chain = anchors(origWords, modernWords);

  const cuts: number[] = [];
  let floor = 1;
  for (const modernStart of modernStarts.slice(1)) {
    const predicted = origPosition(chain, modernStart);
    let best = -1;
    let bestScore = Infinity;
    for (let b = floor; b < blocks.length; b += 1) {
      const distance = Math.abs((starts[b] ?? 0) - predicted);
      // An entrance wins over a plain boundary a little nearer; not over one much nearer,
      // since an original may omit the entrance that begins a scene.
      const score = isEntrance(blocks[b] as Block) ? distance : distance + ENTRANCE_PREFERENCE;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    if (best < 0) {
      break;
    }
    // Cutting before an entrance leaves the previous scene's exit with it.
    cuts.push(best);
    floor = best + 1;
  }
  const pieces: Block[][] = [];
  let from = 0;
  for (const cut of cuts) {
    pieces.push(blocks.slice(from, cut));
    from = cut;
  }
  pieces.push(blocks.slice(from));
  return pieces;
}

/**
 * Groups scenes in reading order into acts: printed acts keep their headings; acts first
 * reached by an added scene are editorial.
 */
function regroup(orig: VersionDocument, result: Placed[]): Act[] {
  const printedActs = new Map(orig.divisions.filter((a) => a.n !== null).map((a) => [a.n, a]));
  const divisions: Act[] = [];
  for (const { actN, scene } of result) {
    const current = divisions.at(-1);
    if (actN !== null && current?.n === actN) {
      current.scenes.push(scene);
      continue;
    }
    const printedAct = actN === null ? undefined : printedActs.get(actN);
    divisions.push(
      printedAct
        ? {
            n: actN,
            editorial: printedAct.editorial,
            ...(printedAct.heading ? { heading: printedAct.heading } : {}),
            scenes: [scene],
          }
        : { n: actN, editorial: actN !== null, scenes: [scene] },
    );
  }
  return divisions;
}

export interface EditorialReport {
  /** Keys of the scenes added, e.g. "3.1". */
  added: string[];
}

/**
 * Supplies editorial divisions from the modern version (CRP-031). Each printed scene covers
 * the modern scenes from its own number up to the next printed scene's; printed scenes that
 * cover several are split. Printed acts and scenes keep their headings; added ones have none.
 */
export function supplyEditorialDivisions(
  orig: VersionDocument,
  modern: VersionDocument,
  options: { order?: 'modern' | 'free'; scenes?: readonly { from: string; scene: string }[] } = {},
): EditorialReport {
  if (options.order === 'free') {
    return supplyReordered(orig, modern, options.scenes);
  }
  const origScenes = placed(orig);
  const modernScenes = placed(modern);
  const firsts = modernCounterparts(origScenes, modernScenes, `${orig.playId} ${orig.versionId}`);
  if (firsts.some((index, i) => i > 0 && index <= (firsts[i - 1] ?? -1))) {
    throw new Error(`${orig.playId} ${orig.versionId}: printed scenes are out of the modern order`);
  }

  const result: Placed[] = [];
  const added: string[] = [];
  origScenes.forEach((printed, i) => {
    const first = firsts[i] ?? 0;
    const end = firsts[i + 1] ?? modernScenes.length;
    const covered = modernScenes.slice(first, end);
    if (covered.length <= 1) {
      result.push(printed);
      return;
    }
    const pieces = split(
      printed.scene.blocks,
      covered.map((p) => p.scene),
    );
    pieces.forEach((blocks, k) => {
      const target = covered[k] as Placed;
      if (k === 0) {
        result.push({ actN: printed.actN, scene: { ...printed.scene, blocks } });
      } else if (blocks.length > 0) {
        added.push(sceneKey(target));
        result.push({
          actN: target.actN,
          scene: {
            id: sceneKey(target),
            kind: target.scene.kind,
            n: target.scene.n,
            editorial: true,
            blocks,
          },
        });
      }
    });
  });

  orig.divisions = regroup(orig, result);
  return { added };
}

// ---------------------------------------------------------------------------------------------
// Versions in a different scene order (CRP-051: Q1 Hamlet)

const TRIGRAM = 3;
/** Words on each side of a block that inform its label. */
const CONTEXT_WORDS = 60;
/** Runs shorter than this many words are absorbed by their neighbours. */
const MIN_RUN = 60;

/**
 * For a version whose scenes come in another order (the first quarto of Hamlet moves "To be,
 * or not to be" before the players arrive), each block is labelled with the modern scene whose
 * three-word phrases its neighbourhood shares most, weighting phrases found in few scenes. Short
 * runs are smoothed away, and each change of label becomes a scene, cut at an entrance nearby
 * if there is one. A modern scene that recurs gets its later pieces as "2.2b", "2.2c".
 */
function supplyReordered(
  orig: VersionDocument,
  modern: VersionDocument,
  curated: readonly { from: string; scene: string }[] | undefined,
): EditorialReport {
  const modernScenes = placed(modern);
  const blocks = placed(orig).flatMap((p) => p.scene.blocks);
  if (curated && curated.length > 0) {
    return applyCuratedScenes(orig, modernScenes, blocks, curated);
  }

  // Trigram weights per modern scene.
  const sceneGrams = modernScenes.map((p) => {
    const words = p.scene.blocks.flatMap(blockWords);
    const grams = new Set<string>();
    for (let i = 0; i + TRIGRAM <= words.length; i += 1) {
      grams.add(words.slice(i, i + TRIGRAM).join(' '));
    }
    return grams;
  });
  const spread = new Map<string, number>();
  for (const grams of sceneGrams) {
    for (const gram of grams) {
      spread.set(gram, (spread.get(gram) ?? 0) + 1);
    }
  }

  // Each block's words, and a label from its neighbourhood.
  const words = blocks.map(blockWords);
  const flat = words.flat();
  const starts: number[] = [];
  let position = 0;
  for (const list of words) {
    starts.push(position);
    position += list.length;
  }
  const labels = blocks.map((_, b) => {
    const from = Math.max(0, (starts[b] ?? 0) - CONTEXT_WORDS);
    const to = Math.min(flat.length, (starts[b] ?? 0) + (words[b]?.length ?? 0) + CONTEXT_WORDS);
    const scores = new Array<number>(modernScenes.length).fill(0);
    for (let i = from; i + TRIGRAM <= to; i += 1) {
      const gram = flat.slice(i, i + TRIGRAM).join(' ');
      const count = spread.get(gram);
      if (count === undefined) {
        continue;
      }
      sceneGrams.forEach((grams, k) => {
        if (grams.has(gram)) {
          scores[k] = (scores[k] ?? 0) + 1 / count;
        }
      });
    }
    const best = Math.max(...scores);
    return best > 0 ? scores.indexOf(best) : -1;
  });

  // Runs of equal labels; unlabelled blocks join the run before them.
  let runs: { label: number; from: number; to: number }[] = [];
  labels.forEach((label, b) => {
    const last = runs.at(-1);
    if (last && (label === last.label || label < 0)) {
      last.to = b + 1;
    } else {
      runs.push({ label, from: b, to: b + 1 });
    }
  });
  const length = (run: { from: number; to: number }) =>
    (starts[run.to] ?? flat.length) - (starts[run.from] ?? 0);
  for (let changed = true; changed;) {
    changed = false;
    const short = runs.findIndex((run) => length(run) < MIN_RUN);
    if (short >= 0 && runs.length > 1) {
      const run = runs[short] as (typeof runs)[number];
      const neighbour =
        short > 0 ? (runs[short - 1] as typeof run) : (runs[short + 1] as typeof run);
      neighbour.from = Math.min(neighbour.from, run.from);
      neighbour.to = Math.max(neighbour.to, run.to);
      runs.splice(short, 1);
      // Neighbours that now share a label become one run.
      runs = runs.reduce<typeof runs>((merged, r) => {
        const last = merged.at(-1);
        if (last?.label === r.label) {
          last.to = r.to;
        } else {
          merged.push({ ...r });
        }
        return merged;
      }, []);
      changed = true;
    }
  }

  // Move each boundary to an entrance within a few blocks, if there is one.
  for (let r = 1; r < runs.length; r += 1) {
    const run = runs[r] as (typeof runs)[number];
    const previous = runs[r - 1] as typeof run;
    const candidates = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6]
      .map((d) => run.from + d)
      .filter(
        (b) =>
          b > previous.from &&
          b < run.to &&
          isEntrance(blocks[b] as Block) &&
          Math.abs((starts[b] ?? 0) - (starts[run.from] ?? 0)) <= 120,
      );
    const cut = candidates[0];
    if (cut !== undefined) {
      previous.to = cut;
      run.from = cut;
    }
  }

  return build(
    orig,
    runs.map((run) => ({
      target: modernScenes[Math.max(0, run.label)] as Placed,
      blocks: blocks.slice(run.from, run.to),
    })),
  );
}

/** Scenes from a reviewed list of starts (curation, CRP-004). */
function applyCuratedScenes(
  orig: VersionDocument,
  modernScenes: Placed[],
  blocks: Block[],
  curated: readonly { from: string; scene: string }[],
): EditorialReport {
  const byKey = new Map(modernScenes.map((p) => [sceneKey(p), p]));
  const starts = curated.map(({ from, scene }) => {
    const index = blocks.findIndex((block) => blockNodes(block)[0]?.id === from);
    const target = byKey.get(scene);
    if (index < 0 || !target) {
      throw new Error(
        `${orig.playId} ${orig.versionId}: curated scene ${scene} at ${from} not found`,
      );
    }
    return { index, target };
  });
  if (
    starts[0]?.index !== 0 ||
    starts.some((s, i) => i > 0 && s.index <= (starts[i - 1]?.index ?? 0))
  ) {
    throw new Error(
      `${orig.playId} ${orig.versionId}: curated scenes must start at the first block, in order`,
    );
  }
  return build(
    orig,
    starts.map(({ index, target }, i) => ({
      target,
      blocks: blocks.slice(index, starts[i + 1]?.index ?? blocks.length),
    })),
  );
}

/** Editorial scenes from pieces in reading order; a recurring scene's later pieces are "b", "c". */
function build(
  orig: VersionDocument,
  pieces: { target: Placed; blocks: Block[] }[],
): EditorialReport {
  const seen = new Map<string, number>();
  const added: string[] = [];
  const result: Placed[] = pieces.map(({ target, blocks }) => {
    const key = sceneKey(target);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    const id = count === 1 ? key : `${key}${String.fromCharCode(97 + count - 1)}`;
    added.push(id);
    return {
      actN: target.actN,
      scene: {
        id,
        kind: target.scene.kind,
        n: target.scene.n,
        editorial: true,
        blocks,
      },
    };
  });
  orig.divisions = regroup({ ...orig, divisions: [] }, result);
  return { added };
}
