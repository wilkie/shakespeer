/**
 * The words generated definitions are written for (GEN-001 – GEN-003): uncommon words and
 * Onions headwords in the modern version's speeches, chosen deterministically.
 */
import type { SourcedDefinitionsFile, VersionDocument } from '../../src/schema.ts';
import { readTarGz } from '../lib/tar.ts';

/** The SCOWL lists that make up its lists of American English (GEN-001). */
const SCOWL_SIZES = [10, 20, 35, 40, 50];
const SCOWL_LISTS = ['english-words', 'english-upper', 'english-contractions', 'american-words'];

/**
 * Modern English words up to a SCOWL size, lower-cased, from the SCOWL release archive: size 50
 * is common English, size 10 the commonest (GEN-001).
 */
export function scowlWords(archive: Uint8Array, maxSize = 50): Set<string> {
  const files = readTarGz(archive);
  const words = new Set<string>();
  // SCOWL's lists are Latin-1.
  const decoder = new TextDecoder('latin1');
  for (const [path, data] of files) {
    const [list, size] = path.split('/').at(-1)?.split('.') ?? [];
    if (list && SCOWL_LISTS.includes(list) && SCOWL_SIZES.includes(Number(size))) {
      if (Number(size) > maxSize) {
        continue;
      }
      for (const word of decoder.decode(data).split('\n')) {
        if (word !== '') {
          words.add(word.toLowerCase().replaceAll('’', "'"));
        }
      }
    }
  }
  if (words.size === 0) {
    throw new Error('No SCOWL word lists found in the archive');
  }
  return words;
}

/**
 * Glossaries whose headwords make their other occurrences candidates (GEN-001): Onions lists
 * only words whose sense needs explaining, where Schmidt covers nearly every word.
 */
const HEADWORD_SOURCES = ['onions-1919'];

/**
 * Function words are never candidates on their own: their unusual senses belong to phrases
 * (GEN-002, Decision 4).
 */
const FUNCTION_WORDS = new Set(
  [
    // Articles and determiners
    'a an the this that these those all any some each every both either neither such no',
    'other another own more most much many few',
    // Pronouns
    'i me my mine myself we us our ours ourselves you your yours yourself yourselves',
    'thou thee thy thine thyself ye he him his himself she her hers herself it its itself',
    "they them their theirs themselves who whom whose which what 'tis tis",
    // Prepositions
    'to of in on at by from with without within upon into onto unto against about above below',
    "under over o'er through between among after before till until toward towards near off",
    'out up down',
    // Conjunctions and adverbs that join
    'and or but nor for so yet if as than though although because since unless while whether',
    'there here then now when where why how not',
    // Auxiliary and modal verbs
    'be am is are was were been being art wert wast have has had hath having do does did doth',
    'done shall shalt should shouldst will wilt would wouldst may mayst might must can canst',
    'could couldst let',
    // Answers
    'ay nay yea yes',
  ]
    .join(' ')
    .split(' '),
);

const SUFFIXES = ["'s", "'d", "'st", 's', 'es', 'ed', 'd', 'ing', 'er', 'est', 'eth', 'st', 'ly'];

/** A word's lower-cased form and the stems its obvious inflections could come from. */
export function forms(word: string): string[] {
  const lower = word.toLowerCase().replaceAll('’', "'").replaceAll('è', 'e');
  // Elided spellings: "wat'ry", "o'er", "stol'n".
  const spellings = lower.includes("'")
    ? [lower, ...['e', 'v', ''].map((letter) => lower.replace(/(?<=\p{L})'(?=\p{L}{2})/u, letter))]
    : [lower];
  return [...new Set(spellings.flatMap(inflections))];
}

function inflections(lower: string): string[] {
  const result = [lower];
  for (const suffix of SUFFIXES) {
    if (!lower.endsWith(suffix)) {
      continue;
    }
    const stem = lower.slice(0, -suffix.length);
    if (stem.length < 2) {
      continue;
    }
    result.push(stem, `${stem}e`);
    if (/([^aeiou])\1$/.test(stem)) {
      result.push(stem.slice(0, -1)); // "stopping" → "stop"
    }
    if (stem.endsWith('i')) {
      result.push(`${stem.slice(0, -1)}y`); // "cried" → "cry"
    }
  }
  return result;
}

export interface Occurrence {
  nodeId: string;
  start: number;
  end: number;
  /** The word as printed. */
  word: string;
}

export interface Candidate {
  /** The lower-cased word the request is about (GEN-011). */
  word: string;
  occurrences: Occurrence[];
}

function tokens(nodeId: string, text: string): Occurrence[] {
  return [...text.matchAll(/\p{L}+(?:['’]\p{L}+)*/gu)].map((match) => ({
    nodeId,
    start: match.index,
    end: match.index + match[0].length,
    word: match[0],
  }));
}

/** One line of a speech in a scene, for candidates and their context (GEN-011). */
export interface SpeechLine {
  nodeId: string;
  text: string;
  speaker: string;
  /** The scene, e.g. "Act 3, Scene 1". */
  scene: string;
}

/** The speech lines of a version, scene by scene, in order; stage directions left out. */
export function speechLines(doc: VersionDocument): SpeechLine[][] {
  return doc.divisions.flatMap((act) =>
    act.scenes.map((scene) => {
      const name =
        scene.kind === 'scene'
          ? `Act ${String(act.n)}, Scene ${String(scene.n)}`
          : `${scene.kind.charAt(0).toUpperCase()}${scene.kind.slice(1)}`;
      return scene.blocks.flatMap((block) =>
        block.type === 'speech'
          ? block.nodes.flatMap((node) =>
              node.kind === 'line'
                ? [{ nodeId: node.id, text: node.text, speaker: block.label, scene: name }]
                : [],
            )
          : [],
      );
    }),
  );
}

/**
 * Candidates for generated definitions in a modern version (GEN-001, GEN-002), grouped by
 * lower-cased word in order of first occurrence.
 */
export function selectCandidates(
  doc: VersionDocument,
  sourced: readonly SourcedDefinitionsFile[],
  common: ReadonlySet<string>,
  commonest: ReadonlySet<string>,
): Candidate[] {
  const all = speechLines(doc)
    .flat()
    .flatMap((line) => tokens(line.nodeId, line.text));

  const headwords = new Set(
    sourced
      .filter((file) => HEADWORD_SOURCES.includes(file.sourceId))
      .flatMap((file) => file.terms.map((term) => term.headword.toLowerCase())),
  );
  const isHeadword = (word: string) => forms(word).some((form) => headwords.has(form));

  // Character names; other proper names are candidates like any word (GEN-002).
  const names = new Set<string>();
  for (const character of doc.characters) {
    for (const part of character.name.split(/[^\p{L}'’]+/u)) {
      if (part !== '' && !isHeadword(part)) {
        names.add(part.toLowerCase());
      }
    }
  }

  const defined = new Map<string, [number, number][]>();
  for (const term of sourced.flatMap((file) => file.terms)) {
    const { start, end } = term.anchor;
    if (start.nodeId === end.nodeId) {
      const spans = defined.get(start.nodeId) ?? [];
      spans.push([start.offset, end.offset]);
      defined.set(start.nodeId, spans);
    }
  }
  const hasDefinition = (t: Occurrence) =>
    (defined.get(t.nodeId) ?? []).some(([start, end]) => start < t.end && t.start < end);

  const candidates = new Map<string, Candidate>();
  for (const token of all) {
    const word = token.word.toLowerCase().replaceAll('’', "'");
    if (
      word.length < 2 ||
      FUNCTION_WORDS.has(word) ||
      /^[IVXLC]{2,}$/.test(token.word) || // Roman numerals
      names.has(word.replace(/'s$/, '')) ||
      hasDefinition(token)
    ) {
      continue;
    }
    const uncommon = !forms(word).some((form) => common.has(form));
    const veryCommon = forms(word).some((form) => commonest.has(form));
    if (!uncommon && !(isHeadword(word) && !veryCommon)) {
      continue;
    }
    const candidate = candidates.get(word) ?? { word, occurrences: [] };
    candidate.occurrences.push({
      nodeId: token.nodeId,
      start: token.start,
      end: token.end,
      word: token.word,
    });
    candidates.set(word, candidate);
  }
  return [...candidates.values()];
}
