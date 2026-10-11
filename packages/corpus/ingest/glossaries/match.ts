/**
 * Anchors glossary citations to specific occurrences in a version (CRP-070, CRP-071).
 *
 * Glossaries cite another edition's line numbers (Schmidt and Onions use the Globe edition),
 * so a citation is matched to an occurrence of the headword within a window around the cited
 * line in the corresponding scene. When the glossary prints the passage, the passage must also
 * agree with the text there. Ambiguous or unmatched citations are skipped, never guessed.
 */
import type {
  LineNode,
  SourcedDefinition,
  SourcedTerm,
  TextAnchor,
  VersionDocument,
} from '../../src/schema.ts';
import { wordKey } from '../align.ts';

export interface GlossCitation {
  headword: string;
  definition: SourcedDefinition;
  act: number | null;
  scene: number | null;
  part?: 'prologue' | 'epilogue';
  line: number;
  quote: string;
}

export interface MatchReport {
  matched: number;
  /** Of those matched, found by their quotation away from the cited place. */
  recovered: number;
  /** Not found near the cited line, or the quotation disagrees. */
  unmatched: { citation: GlossCitation; reason: string }[];
}

/** Characters of surrounding text kept in anchors (ANC-002 allows up to 32). */
const CONTEXT = 20;

interface SceneLines {
  lines: LineNode[];
  /** Folger line number within the scene, per line. */
  numbers: number[];
}

function sceneLines(doc: VersionDocument): Map<string, SceneLines> {
  const scenes = new Map<string, SceneLines>();
  for (const act of doc.divisions) {
    for (const scene of act.scenes) {
      const lines = scene.blocks.flatMap((block) =>
        block.type === 'speech'
          ? block.nodes.filter((node): node is LineNode => node.kind === 'line')
          : [],
      );
      const numbers = lines.map((line) => Number(/(\d+)$/.exec(line.n ?? '')?.[1] ?? NaN));
      const key = scene.kind === 'scene' ? `${String(act.n)}.${String(scene.n)}` : scene.kind; // "prologue", "epilogue"
      scenes.set(key, { lines, numbers });
    }
  }
  return scenes;
}

/** Scenes of an act, to resolve citations that omit the scene of a single-scene act. */
function scenesOfAct(scenes: Map<string, SceneLines>, act: number): string[] {
  return [...scenes.keys()].filter(
    (key) => key.startsWith(`${String(act)}.`) && !key.includes('logue'),
  );
}

interface Word {
  start: number;
  end: number;
  key: string;
}

function words(text: string): Word[] {
  return [...text.matchAll(/[\p{L}’'-]+/gu)].map((match) => {
    const raw = match[0].replace(/^['’-]+|['’-]+$/g, '');
    const start = match.index + match[0].indexOf(raw);
    return { start, end: start + raw.length, key: wordKey(raw) };
  });
}

/** Whether a word in the text is a form of the headword ("bodkin", "bodkins", "bobbed"). */
function isFormOf(word: string, headword: string): boolean {
  return word === headword || (word.startsWith(headword) && word.length - headword.length <= 3);
}

function anchorFor(line: LineNode, word: Word, revision: string): TextAnchor {
  return {
    start: { nodeId: line.id, offset: word.start },
    end: { nodeId: line.id, offset: word.end },
    quote: {
      exact: line.text.slice(word.start, word.end),
      prefix: line.text.slice(Math.max(0, word.start - CONTEXT), word.start),
      suffix: line.text.slice(word.end, word.end + CONTEXT),
    },
    revision,
  };
}

/**
 * A citation whose scene or line number is unusable (misread in the scan) is recovered only by
 * its quotation: enough of its words around a single line, anywhere in the given scenes.
 */
function recoverByQuote(
  item: Omit<Resolved, 'scene' | 'sceneKey'>,
  scenes: Map<string, SceneLines>,
  keys: readonly string[],
): { sceneKey: string; scene: SceneLines; candidate: Candidate } | undefined {
  if (item.quoteKeys.size < 3) {
    return undefined;
  }
  const needed = Math.max(3, Math.ceil(item.quoteKeys.size * 0.6));
  const found: { sceneKey: string; scene: SceneLines; candidate: Candidate }[] = [];
  for (const sceneKey of keys) {
    const scene = scenes.get(sceneKey);
    if (!scene) {
      continue;
    }
    for (const candidate of candidatesIn({ ...item, scene, sceneKey }, -Infinity, Infinity)) {
      if (candidate.overlap >= needed) {
        found.push({ sceneKey, scene, candidate });
      }
    }
  }
  const lines = new Set(found.map((f) => `${f.sceneKey}:${String(f.candidate.index)}`));
  return lines.size === 1 ? found[0] : undefined;
}

/** Lines on each side of the predicted line that a citation may match. */
const NEAR = 15;

interface Resolved {
  citation: GlossCitation;
  headword: string;
  scene: SceneLines;
  sceneKey: string;
  quoteKeys: Set<string>;
}

interface Candidate {
  index: number;
  word: Word;
  folgerLine: number;
  overlap: number;
}

function candidatesIn(item: Resolved, from: number, to: number): Candidate[] {
  const { scene, headword, quoteKeys } = item;
  const found: Candidate[] = [];
  scene.lines.forEach((line, index) => {
    const folgerLine = scene.numbers[index] ?? NaN;
    if (!(folgerLine >= from && folgerLine <= to)) {
      return;
    }
    const context = new Set(
      [scene.lines[index - 1], line, scene.lines[index + 1]].flatMap((l) =>
        l ? words(l.text).map((w) => w.key) : [],
      ),
    );
    const overlap = [...quoteKeys].filter((key) => context.has(key)).length;
    for (const word of words(line.text)) {
      if (isFormOf(word.key, headword)) {
        found.push({ index, word, folgerLine, overlap });
      }
    }
  });
  return found;
}

/**
 * Glossaries cite Globe line numbers, which drift from Folger's within long scenes (Folger
 * numbers each part of a shared verse line). Each scene's drift is learned from confident
 * matches: long quotations found unambiguously anywhere in the scene.
 */
/** Learned (cited line, Folger line) pairs per scene. */
export type SceneOffsets = Map<string, [number, number][]>;

function learnOffsets(items: Resolved[]): SceneOffsets {
  const pairs = new Map<string, [number, number][]>();
  for (const item of items) {
    const needed = Math.max(3, Math.ceil(item.quoteKeys.size * 0.6));
    if (item.quoteKeys.size < 3) {
      continue;
    }
    const strong = candidatesIn(item, -Infinity, Infinity).filter((c) => c.overlap >= needed);
    const lines = new Set(strong.map((c) => c.index));
    const best = strong[0];
    if (best && lines.size === 1) {
      const list = pairs.get(item.sceneKey) ?? [];
      list.push([item.citation.line, best.folgerLine]);
      pairs.set(item.sceneKey, list);
    }
  }
  for (const list of pairs.values()) {
    list.sort((a, b) => a[0] - b[0]);
  }
  return pairs;
}

/** The Folger line predicted for a Globe line: median offset of the nearest learned pairs. */
function predict(pairs: [number, number][] | undefined, globeLine: number): number {
  if (!pairs || pairs.length === 0) {
    return globeLine;
  }
  const nearest = [...pairs]
    .sort((a, b) => Math.abs(a[0] - globeLine) - Math.abs(b[0] - globeLine))
    .slice(0, 5)
    .map(([globe, folger]) => folger - globe)
    .sort((a, b) => a - b);
  return globeLine + (nearest[Math.floor(nearest.length / 2)] ?? 0);
}

/**
 * Matches a glossary's citations to a version. `prior` offsets, learned from another glossary
 * citing the same numbering, help where this glossary's own quotations are too short to learn
 * from (Onions quotes briefly; Schmidt at length).
 */
export function matchCitations(
  doc: VersionDocument,
  sourceId: string,
  citations: GlossCitation[],
  prior?: SceneOffsets,
  options: { recover?: boolean } = {},
): { terms: SourcedTerm[]; report: MatchReport; offsets: SceneOffsets } {
  const scenes = sceneLines(doc);
  const allScenes = [...scenes.keys()];
  const terms = new Map<string, SourcedTerm>();
  const report: MatchReport = { matched: 0, recovered: 0, unmatched: [] };
  const recover = options.recover ?? false;

  const accept = (citation: GlossCitation, line: LineNode, word: Word) => {
    const anchor = anchorFor(line, word, doc.revision);
    const id = `${sourceId}:${line.id}:${String(word.start)}`;
    const term = terms.get(id) ?? { id, anchor, headword: citation.headword, definitions: [] };
    if (!term.definitions.some((d) => d.meaning === citation.definition.meaning)) {
      term.definitions.push(citation.definition);
    }
    terms.set(id, term);
    report.matched += 1;
  };
  /** Tries the scenes in order, each list on its own, stopping at the first unique match. */
  const recovered = (
    citation: GlossCitation,
    headword: string,
    quoteKeys: Set<string>,
    ...tries: string[][]
  ) => {
    if (!recover) {
      return false;
    }
    for (const keys of tries) {
      const found = recoverByQuote({ citation, headword, quoteKeys }, scenes, keys);
      if (found) {
        accept(
          citation,
          found.scene.lines[found.candidate.index] as LineNode,
          found.candidate.word,
        );
        report.recovered += 1;
        return true;
      }
    }
    return false;
  };

  const resolved: Resolved[] = [];
  for (const citation of citations) {
    const headword = wordKey(citation.headword);
    if (headword.length < 2 || /\s/.test(citation.headword)) {
      report.unmatched.push({ citation, reason: 'unsupported headword' });
      continue;
    }
    let sceneKey: string | undefined;
    if (citation.part) {
      sceneKey = citation.part;
    } else if (citation.act !== null && citation.scene !== null) {
      sceneKey = `${String(citation.act)}.${String(citation.scene)}`;
    } else if (citation.act !== null) {
      const options = scenesOfAct(scenes, citation.act);
      sceneKey = options.length === 1 ? options[0] : undefined;
    }
    // Quotation words other than the headword (Schmidt abbreviates it to "b." or "—").
    const quoteKeys = new Set(
      words(citation.quote)
        .map((w) => w.key)
        .filter((key) => key.length > 2 && !isFormOf(key, headword)),
    );
    const scene = sceneKey ? scenes.get(sceneKey) : undefined;
    if (!scene || !sceneKey) {
      // A misread act or scene number: the quotation alone may still place it.
      const inAct = citation.act !== null ? scenesOfAct(scenes, citation.act) : [];
      if (!recovered(citation, headword, quoteKeys, inAct, allScenes)) {
        report.unmatched.push({ citation, reason: 'no such scene' });
      }
      continue;
    }
    resolved.push({ citation, headword, scene, sceneKey, quoteKeys });
  }

  const learned = learnOffsets(resolved);
  const offsets: SceneOffsets = new Map(prior);
  for (const [scene, pairs] of learned) {
    offsets.set(
      scene,
      [...(offsets.get(scene) ?? []), ...pairs].sort((a, b) => a[0] - b[0]),
    );
  }

  for (const item of resolved) {
    const { citation, scene, quoteKeys } = item;
    const predicted = predict(offsets.get(item.sceneKey), citation.line);
    const candidates = candidatesIn(item, predicted - NEAR, predicted + NEAR).map((c) => ({
      ...c,
      distance: Math.abs(c.folgerLine - predicted),
    }));
    if (candidates.length === 0) {
      // A misread line or scene number: the quotation alone may still place it.
      if (!recovered(citation, item.headword, quoteKeys, [item.sceneKey], allScenes)) {
        report.unmatched.push({ citation, reason: 'headword not found near cited line' });
      }
      continue;
    }

    let chosen: (typeof candidates)[number] | undefined;
    if (quoteKeys.size >= 3) {
      // An informative quotation must agree with the text, and pick a single line.
      const needed = Math.min(2, quoteKeys.size);
      const agreeing = candidates.filter((c) => c.overlap >= needed);
      agreeing.sort((a, b) => b.overlap - a.overlap || a.distance - b.distance);
      const [best, second] = agreeing;
      if (!best) {
        if (!recovered(citation, item.headword, quoteKeys, [item.sceneKey], allScenes)) {
          report.unmatched.push({ citation, reason: 'quotation disagrees' });
        }
        continue;
      }
      if (
        second &&
        second.index !== best.index &&
        second.overlap === best.overlap &&
        second.distance === best.distance
      ) {
        report.unmatched.push({ citation, reason: 'ambiguous' });
        continue;
      }
      chosen = best;
    } else {
      // Without a usable quotation, only an unmistakable occurrence will do: the only line
      // nearby with the headword, or one much closer than any other.
      const byLine = [...new Map(candidates.map((c) => [c.index, c])).values()].sort(
        (a, b) => a.distance - b.distance,
      );
      const [best, second] = byLine;
      if (best && (!second || (best.distance <= 3 && second.distance - best.distance >= 8))) {
        chosen = best;
      } else {
        report.unmatched.push({ citation, reason: 'ambiguous' });
        continue;
      }
    }

    accept(citation, scene.lines[chosen.index] as LineNode, chosen.word);
  }

  const ordered = [...terms.values()].sort((a, b) =>
    a.id.localeCompare(b.id, 'en', { numeric: true }),
  );
  return { terms: ordered, report, offsets: learned };
}
