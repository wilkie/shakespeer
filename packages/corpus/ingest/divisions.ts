/**
 * Editorial divisions (CRP-031): where an original version prints fewer act or scene divisions
 * than the modern one (the First Folio's Hamlet stops dividing in Act 2, its Troilus after the
 * first heading), its long printed scenes are split where the modern scenes begin, found
 * through the text itself, and the added divisions are flagged `editorial: true`.
 */
import type { Act, Block, Scene, TextNode, VersionDocument } from '../src/schema.ts';
import { wordKey } from './align.ts';

/** A scene in reading order with the act it belongs to. */
interface Placed {
  actN: number | null;
  scene: Scene;
}

function placed(doc: Pick<VersionDocument, 'divisions'>): Placed[] {
  return doc.divisions.flatMap((act) => act.scenes.map((scene) => ({ actN: act.n, scene })));
}

/** "2.1", or "prologue", "5.epilogue": how a scene is matched across versions. */
export function sceneKey({ actN, scene }: Placed): string {
  return scene.kind === 'scene'
    ? `${String(actN)}.${String(scene.n)}`
    : actN === null
      ? scene.kind
      : `${String(actN)}.${scene.kind}`;
}

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

/** How far (in words) to look for an entrance near a predicted scene start. */
const WINDOW = 120;

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
      // Entrances within the window win over plain boundaries.
      const score =
        isEntrance(blocks[b] as Block) && distance <= WINDOW ? distance : distance + WINDOW * 4;
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
): EditorialReport {
  const origScenes = placed(orig);
  const modernScenes = placed(modern);
  const modernIndex = new Map(modernScenes.map((p, i) => [sceneKey(p), i]));
  // A prologue or epilogue may sit in an act in one version and stand alone in the other.
  const byKind = new Map<string, number[]>();
  modernScenes.forEach((p, i) => {
    byKind.set(p.scene.kind, [...(byKind.get(p.scene.kind) ?? []), i]);
  });
  const firsts = origScenes.map((p) => {
    const sameKind = byKind.get(p.scene.kind) ?? [];
    const index =
      modernIndex.get(sceneKey(p)) ??
      (p.scene.kind !== 'scene' && sameKind.length === 1 ? sameKind[0] : undefined);
    if (index === undefined) {
      throw new Error(
        `${orig.playId} ${orig.versionId}: printed scene ${sceneKey(p)} has no modern counterpart`,
      );
    }
    return index;
  });
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

  // Regroup into acts: printed acts keep their headings; acts first reached by an added scene
  // are editorial.
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
            editorial: false,
            ...(printedAct.heading ? { heading: printedAct.heading } : {}),
            scenes: [scene],
          }
        : { n: actN, editorial: actN !== null, scenes: [scene] },
    );
  }
  orig.divisions = divisions;
  return { added };
}
