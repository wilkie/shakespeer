/**
 * Parses Schmidt's Shakespeare-Lexicon (3rd ed., 1902) from the Internet Archive's OCR text
 * layer into entries, senses and citations (CRP-071, CRP-073).
 *
 * The layout is regular: an entry starts with a capitalized headword and a comma (or a
 * parenthetical and a colon), optionally a part of speech, then numbered senses "1) … 2) …".
 * A sense's gloss runs to its first colon; quotations follow, each followed by its citation,
 * e.g. "… the head of a b. LLL V, 2, 615." Citations use Globe edition numbering; later bare
 * numbers continue the same play, act and scene, and single-scene acts omit the scene number.
 */
import type { PartOfSpeech } from '../../src/schema.ts';

export interface Citation {
  /** Schmidt's play abbreviation, normalized (e.g. "Tp", "Hml", "Troil"). */
  play: string;
  act: number | null;
  /** Null when Schmidt omitted it (single-scene acts) or for prologues. */
  scene: number | null;
  /** "prologue" / "epilogue" for citations like "Troil. Prol. 5". */
  part?: 'prologue' | 'epilogue';
  line: number;
  /** The quotation printed before the citation, if any. */
  quote: string;
}

export interface Sense {
  label: string | undefined;
  gloss: string;
  citations: Citation[];
}

export interface Entry {
  headword: string;
  partOfSpeech: PartOfSpeech | undefined;
  senses: Sense[];
}

/** Schmidt's play and poem abbreviations, with OCR variants mapped to the canonical form. */
const PLAYS: Record<string, string> = {
  Ado: 'Ado',
  "All's": "All's",
  'All’s': "All's",
  Ant: 'Ant',
  As: 'As',
  Caes: 'Caes',
  Compl: 'Compl',
  Cor: 'Cor',
  Cymb: 'Cymb',
  Err: 'Err',
  Gentl: 'Gentl',
  Gent: 'Gentl',
  H4A: 'H4A',
  H4B: 'H4B',
  H5: 'H5',
  H6A: 'H6A',
  H6B: 'H6B',
  HGB: 'H6B',
  H6C: 'H6C',
  H8: 'H8',
  Hml: 'Hml',
  John: 'John',
  LLL: 'LLL',
  Lr: 'Lr',
  Lucr: 'Lucr',
  Mcb: 'Mcb',
  Meas: 'Meas',
  Merch: 'Merch',
  Mids: 'Mids',
  Oth: 'Oth',
  Per: 'Per',
  Phoen: 'Phoen',
  Pilgr: 'Pilgr',
  R2: 'R2',
  R3: 'R3',
  Rom: 'Rom',
  Shr: 'Shr',
  Sonn: 'Sonn',
  Tim: 'Tim',
  Tit: 'Tit',
  Tp: 'Tp',
  Troil: 'Troil',
  Tw: 'Tw',
  Ven: 'Ven',
  Wint: 'Wint',
  Wiv: 'Wiv',
};

const PART_OF_SPEECH: Record<string, PartOfSpeech> = {
  subst: 'noun',
  prepos: 'preposition',
  vb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  pron: 'pronoun',
  prep: 'preposition',
  conj: 'conjunction',
  interj: 'interjection',
};

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

/**
 * Reads an act numeral the OCR may have garbled: "Il", "IU", "Ill", "HI", "TII", "lV", "Y".
 * Returns undefined if it is not a plausible act number (I–V).
 */
export function readRoman(token: string): number | undefined {
  const cleaned = token
    .replaceAll('H', 'II')
    .replaceAll('U', 'II')
    .replace(/[lT1|]/g, 'I')
    .replaceAll('Y', 'V')
    .replace(/^IIII$/, 'III');
  return ROMAN[cleaned];
}

// ---------------------------------------------------------------------------------------------
// Text cleanup

/** Lines that are page furniture or column-rule noise rather than dictionary text. */
function isNoise(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, '').length;
  return (
    /^\d{1,4}$/.test(line) ||
    /^[A-Z][a-z'’-]+\s+\d{1,4}\s+[A-Z][a-z'’-]+$/.test(line) || // running head "Boast 115 Bob"
    (line.length > 0 && letters / line.length < 0.4 && !/\d+,\s*\d+/.test(line))
  );
}

/** Joins lines into paragraphs, undoing line-end hyphenation. */
function paragraphs(text: string): string[] {
  const result: string[] = [];
  let current = '';
  const lines = text.split('\n').map((line) =>
    line
      .replace(/^[|_`~»]\s*/, '')
      .replace(/\s*\|$/, '')
      .trim(),
  );
  for (const line of lines) {
    if (line === '' || isNoise(line)) {
      // A blank line ends a paragraph unless a hyphenated word is waiting for its end.
      if (line === '' && current !== '' && !current.endsWith('-')) {
        result.push(current);
        current = '';
      }
      continue;
    }
    if (current.endsWith('-') && /^[a-z]/.test(line)) {
      current = current.slice(0, -1) + line;
    } else {
      current = current === '' ? line : `${current} ${line}`;
    }
  }
  if (current !== '') {
    result.push(current);
  }
  return result.map((p) => p.replace(/\s+/g, ' '));
}

// ---------------------------------------------------------------------------------------------
// Entries

const HEADWORD = /^([A-Z][A-Za-z'’-]*)(?:\s*\([^)]*\))?\s*[,:]\s+(.*)$/;

function headwordKey(headword: string): string {
  return headword.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Indices of a longest non-decreasing subsequence of keys. Real headwords are in alphabetical
 * order; lines that merely look like headwords are not, so they fall outside it.
 */
export function alphabeticalRun(keys: string[]): Set<number> {
  const tails: number[] = []; // index of the smallest tail of each run length
  const previous = new Array<number>(keys.length).fill(-1);
  keys.forEach((key, i) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((keys[tails[mid] ?? 0] ?? '') <= key) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    previous[i] = low > 0 ? (tails[low - 1] ?? -1) : -1;
    tails[low] = i;
  });
  const run = new Set<number>();
  for (let i = tails.at(-1) ?? -1; i >= 0; i = previous[i] ?? -1) {
    run.add(i);
  }
  return run;
}

/** Splits the dictionary into entries. */
export function parseEntries(text: string): Entry[] {
  const paras = paragraphs(text);
  const candidates = paras.flatMap((paragraph, index) => {
    const match = HEADWORD.exec(paragraph);
    const headword = match?.[1];
    return headword && !(headword.replace(/’/g, "'") in PLAYS)
      ? [{ index, headword, key: headwordKey(headword), body: match[2] ?? '' }]
      : [];
  });
  const run = alphabeticalRun(candidates.map((c) => c.key));
  const starts = new Map(candidates.filter((_, i) => run.has(i)).map((c) => [c.index, c]));

  const entries: { headword: string; body: string[] }[] = [];
  paras.forEach((paragraph, index) => {
    const start = starts.get(index);
    if (start) {
      entries.push({ headword: start.headword, body: [start.body] });
    } else {
      entries.at(-1)?.body.push(paragraph);
    }
  });
  return entries.map(({ headword, body }) => parseEntry(headword, body.join('\n')));
}

function parseEntry(headword: string, body: string): Entry {
  let rest = body;
  let partOfSpeech: PartOfSpeech | undefined;
  const pos = /^(subst|vb|adj|adv|pron|prepos|prep|conj|interj)\.,?\s*/.exec(rest);
  if (pos?.[1]) {
    partOfSpeech = PART_OF_SPEECH[pos[1]];
    rest = rest.slice(pos[0].length);
  }
  // Senses start with "1)" at the start of the entry or of a paragraph.
  const parts = rest.split(/(?:^|\n|,\s)(?=\d{1,2}\)\s)/);
  const senses = parts.flatMap((part): Sense[] => {
    const labelled = /^(\d{1,2})\)\s+([\s\S]*)$/.exec(part);
    const label = labelled?.[1];
    const content = (labelled?.[2] ?? part).replace(/\n/g, ' ');
    return parseSense(label, content);
  });
  return { headword, partOfSpeech, senses };
}

/**
 * A sense: the gloss runs to the first colon. Later "Hence = X:" segments start a derived sense
 * with gloss X; other segments ("Followed by of:") keep the current gloss.
 */
function parseSense(label: string | undefined, content: string): Sense[] {
  const colon = content.indexOf(':');
  const gloss = colon >= 0 ? content.slice(0, colon) : '';
  const senses: Sense[] = [{ label, gloss: cleanGloss(gloss), citations: [] }];
  let remainder = colon >= 0 ? content.slice(colon + 1) : content;

  for (;;) {
    const derived = /\bHence\s*=\s*([^:]{2,80}):/.exec(remainder);
    const head = derived ? remainder.slice(0, derived.index) : remainder;
    (senses.at(-1) as Sense).citations.push(...parseCitations(head));
    if (!derived) {
      break;
    }
    senses.push({ label, gloss: cleanGloss(derived[1] ?? ''), citations: [] });
    remainder = remainder.slice(derived.index + derived[0].length);
  }
  return senses;
}

/** Glosses that describe grammar ("Adjectively and pronominally") rather than meaning. */
const GRAMMATICAL_NOTE =
  /^(?:used|adjectively|substantively|adverbially|followed|preceded|joined|omitted|placed|put|absol|elliptically|redundantly|inserted|in the sense|the art)\b/i;

function cleanGloss(gloss: string): string {
  if (GRAMMATICAL_NOTE.test(gloss.trim())) {
    return '';
  }
  const cleaned = gloss
    .replace(/\(cf\.[^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    // Grammatical labels and sub-sense letters before the meaning: "trans. a) to unclose".
    .replace(
      /^(?:(?:trans|intrans|intr|tr|refl|absol|impers|partic|pron|adj|adv|subst|vb|fem|masc)\.\s*|[a-z]\)\s*)+/i,
      '',
    )
    // Usage notes after it: "to be tenderly affected; absol. = to be in love".
    .replace(/[;,]\s*(?:[a-z]\)\s*)?(?:absol(?:utely|\.)?|trans\.|intrans\.|intr\.|tr\.).*$/i, '')
    .replace(/[\s,;]+$/, '')
    .trim();
  // Nothing left but abbreviations ("refl. pron.") is not a meaning.
  if (!/[A-Za-z]{3,}(?![.\w])/.test(cleaned)) {
    return '';
  }
  // A "gloss" containing a citation is really a quotation; there is no gloss.
  return /\b[IVX]{1,3},\s*\d/.test(cleaned) || /\d+,\s*\d+/.test(cleaned) ? '' : cleaned;
}

// ---------------------------------------------------------------------------------------------
// Citations

const PLAY_PATTERN = Object.keys(PLAYS)
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const TOKEN = new RegExp(
  [
    `(?<play>(?<![A-Za-z])(?:${PLAY_PATTERN})(?![A-Za-z]))\\.?`,
    String.raw`(?<part>\b(?:Prol|Epil|Chor))\.?`,
    // An act numeral, possibly misread ("Il", "1I"), but never digits alone (those are scenes).
    String.raw`(?<roman>(?<![A-Za-z0-9])(?=[1|]*[IVXlTHUY])[IVXlTHUY1|]{1,4}),\s*(?=\d)`,
    String.raw`(?<num>\d{1,4})(?<sep>\s*[,.;]?)`,
    String.raw`(?<word>[^\s]+)`,
  ].join('|'),
  'g',
);

/**
 * Scans a quotation-and-citation run. Each citation takes the words printed since the previous
 * citation as its quotation.
 */
export function parseCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  let play: string | undefined;
  let act: number | null = null;
  let scene: number | null = null;
  let part: Citation['part'];
  let numbers: number[] = [];
  let quote: string[] = [];
  let expectLocator = false;

  const emit = (line: number) => {
    if (play) {
      citations.push({
        play,
        act,
        scene,
        ...(part ? { part } : {}),
        line,
        quote: quote.join(' ').replace(/[\s,;:.]+$/, ''),
      });
    }
    quote = [];
  };

  /** Interprets the numbers collected since a numeral or play abbreviation. */
  const flush = () => {
    if (numbers.length === 0) {
      return;
    }
    if (part) {
      numbers.forEach(emit);
    } else if (numbers.length === 3 && expectLocator) {
      // "1, 2, 68": an act numeral the OCR read as a digit.
      [act, scene] = [numbers[0] ?? null, numbers[1] ?? null];
      emit(numbers[2] ?? 0);
    } else if (numbers.length >= 2 && expectLocator) {
      scene = numbers[0] ?? null;
      numbers.slice(1).forEach(emit);
    } else if (expectLocator && act !== null) {
      scene = null; // single-scene act: "Tp. IV, 191"
      numbers.forEach(emit);
    } else {
      numbers.forEach(emit);
    }
    numbers = [];
    expectLocator = false;
  };

  for (const match of text.matchAll(TOKEN)) {
    const groups = match.groups ?? {};
    if (groups['play']) {
      flush();
      play = PLAYS[groups['play'].replace(/’/g, "'")];
      act = null;
      scene = null;
      part = undefined;
      expectLocator = true;
    } else if (groups['part']) {
      flush();
      part =
        groups['part'] === 'Prol' ? 'prologue' : groups['part'] === 'Epil' ? 'epilogue' : undefined;
      if (!part) {
        play = undefined; // choruses (H5) are not in the corpus
      }
    } else if (groups['roman'] !== undefined) {
      flush();
      const n = readRoman(groups['roman']);
      if (n === undefined) {
        play = undefined;
      } else {
        act = n;
        scene = null;
        part = undefined;
        expectLocator = true;
      }
    } else if (groups['num'] !== undefined) {
      numbers.push(Number(groups['num']));
      // A comma means the reference continues ("2, 146"); anything else ends it.
      if (!(groups['sep'] ?? '').includes(',')) {
        flush();
      }
    } else {
      flush();
      quote.push(groups['word'] ?? '');
    }
  }
  flush();
  return citations;
}
