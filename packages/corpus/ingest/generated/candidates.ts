/**
 * The words generated definitions are written for (GEN-001 – GEN-003): uncommon words and
 * glossary headwords in the modern version's speeches, chosen deterministically.
 */
import type { SourcedDefinitionsFile, VersionDocument } from '../../src/schema.ts';
import { readTarGz } from '../lib/tar.ts';

/** The SCOWL lists that make up its size-50 list of American English (GEN-001). */
const SCOWL_SIZES = ['10', '20', '35', '40', '50'];
const SCOWL_LISTS = ['english-words', 'english-upper', 'english-contractions', 'american-words'];

/** Common modern English, lower-cased, from the SCOWL release archive. */
export function scowlWords(archive: Uint8Array): Set<string> {
  const files = readTarGz(archive);
  const words = new Set<string>();
  // SCOWL's lists are Latin-1.
  const decoder = new TextDecoder('latin1');
  for (const [path, data] of files) {
    const [list, size] = path.split('/').at(-1)?.split('.') ?? [];
    if (list && size && SCOWL_LISTS.includes(list) && SCOWL_SIZES.includes(size)) {
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

/** A word in a line, with whether it starts the line or a sentence. */
interface Token extends Occurrence {
  initial: boolean;
}

function tokens(nodeId: string, text: string): Token[] {
  return [...text.matchAll(/\p{L}+(?:['’]\p{L}+)*/gu)].map((match, i) => ({
    nodeId,
    start: match.index,
    end: match.index + match[0].length,
    word: match[0],
    initial: i === 0 || /[.!?]['’”")\]]*\s*$/.test(text.slice(0, match.index)),
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

  // Proper names: capitalized where they need not be, and never in lower case (GEN-002).
  const lowerCased = new Set(
    all.filter((t) => !/^\p{Lu}/u.test(t.word)).map((t) => t.word.toLowerCase()),
  );
  const names = new Set(
    all
      .filter((t) => !t.initial && /^\p{Lu}/u.test(t.word))
      .map((t) => t.word.toLowerCase().replace(/['’]s$/, ''))
      .filter((word) => !lowerCased.has(word) && !isHeadword(word)),
  );
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
  const hasDefinition = (t: Token) =>
    (defined.get(t.nodeId) ?? []).some(([start, end]) => start < t.end && t.start < end);

  const candidates = new Map<string, Candidate>();
  for (const token of all) {
    const word = token.word.toLowerCase().replaceAll('’', "'");
    if (
      word.length < 2 ||
      /^[IVXLC]{2,}$/.test(token.word) || // Roman numerals
      names.has(word.replace(/'s$/, '')) ||
      hasDefinition(token)
    ) {
      continue;
    }
    const uncommon = !forms(word).some((form) => common.has(form));
    if (!uncommon && !isHeadword(word)) {
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
