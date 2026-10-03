/**
 * Parses Onions' A Shakespeare Glossary (2nd ed., 1919) from the Internet Archive's OCR text
 * layer into entries, senses and citations (CRP-071, CRP-073).
 *
 * An entry starts a line with its lowercase headword, then optionally variant spellings, a part
 * of speech and a parenthetical note, then either ": gloss citations" or numbered senses on the
 * following lines ("1 gloss citations"). A citation is "Ham. iii. i. 76" (act, scene, line in
 * the Oxford edition's numbering, close to the Globe's) followed by its quotation, in which the
 * headword is abbreviated ("A. thy hours!", "a-d" for "abated"). Alternative references in
 * square brackets, variant readings in parentheses, "cf." references and ¶ notes are dropped.
 */
import type { PartOfSpeech } from '../../src/schema.ts';
import { alphabeticalRun, type Citation, type Entry, type Sense } from './schmidt.ts';

/** Onions' play and poem abbreviations (§ 4), normalized without dots or spaces. */
const PLAYS = [
  'Ado',
  "All'sW",
  'Ant',
  'AYL',
  'Caes',
  'Compl',
  'Cor',
  'Cym',
  'Err',
  'Gent',
  '1H4',
  '2H4',
  'H5',
  '1H6',
  '2H6',
  '3H6',
  'H8',
  'Ham',
  'John',
  'LLL',
  'Lr',
  'Lucr',
  'Mac',
  'Meas',
  'MerV',
  'MND',
  'Oth',
  'Per',
  'Phoen',
  'Pilgr',
  'R2',
  'R3',
  'Rom',
  'Shr',
  'Sonn',
  'Tim',
  'Tit',
  'Tp',
  'Troil',
  'TwN',
  'Ven',
  'Wint',
  'Wiv',
];

const PART_OF_SPEECH: Record<string, PartOfSpeech> = {
  sb: 'noun',
  vb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  prep: 'preposition',
  conj: 'conjunction',
  interj: 'interjection',
  int: 'interjection',
  pron: 'pronoun',
};

const ROMAN: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
  xiii: 13,
  xiv: 14,
  xv: 15,
};

/**
 * Reads a roman numeral the OCR may have garbled. Acts are printed in small capitals, which the
 * OCR often reads as lowercase look-alikes: "n" (II), "in", "m", "hi", "ill" (III), "rv" (IV).
 */
export function readOnionsRoman(token: string): number | undefined {
  const lower = token.toLowerCase().replace(/[1|l]/g, 'i');
  const fixed =
    { n: 'ii', u: 'ii', in: 'iii', m: 'iii', hi: 'iii', iu: 'iii', rv: 'iv', y: 'v' }[lower] ??
    lower;
  return ROMAN[fixed];
}

/** A line number, allowing the OCR's letter-for-digit swaps ("1l6" for 116, "2O" for 20). */
function readLineNumber(token: string): number | undefined {
  if (!/^\d/.test(token)) {
    return undefined;
  }
  const digits = token.replace(/[lI|i]/g, '1').replace(/[Oo]/g, '0');
  return /^\d{1,4}$/.test(digits) ? Number(digits) : undefined;
}

// ---------------------------------------------------------------------------------------------
// Lines and entries

/** Running heads ("ABATE — ABHOR", "-ABSOLUTE"), page numbers and other page furniture. */
function isNoise(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, '');
  return (
    /^[\d\s]{1,5}$/.test(line) ||
    (letters.length > 0 &&
      letters === letters.toUpperCase() &&
      !/[a-z]/.test(line) &&
      !/\d{2}/.test(line)) ||
    (line.length > 0 && letters.length / line.length < 0.3)
  );
}

const HEAD = new RegExp(
  [
    String.raw`^(?<head>[A-Za-z][a-z'’-]*(?: [a-z][a-z'’-]*){0,2})[\d¹²³]?`,
    String.raw`(?<variants>(?:\s*,\s*[a-z][a-z'’-]*[\d¹²³]?)*)`,
    String.raw`\s*(?:(?<pos>sb|vb|adj|adv|prep|conj|interj|int|pron)\.\s*[\d'’¹²³]?)?`,
    // "care occurs in various proverbs and phrases : …"
    String.raw`(?:\s+occurs\b[^:]*(?=:))?`,
    String.raw`\s*(?<sep>:|\(|\{|$)`,
  ].join(''),
);

function headwordKey(headword: string): string {
  return headword.toLowerCase().replace(/[^a-z]/g, '');
}

/** Splits the glossary into entries. */
export function parseOnions(text: string): Entry[] {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '' && !isNoise(line));

  const candidates = lines.flatMap((line, index) => {
    const match = HEAD.exec(line);
    const groups = match?.groups;
    if (!match || !groups?.['head']) {
      return [];
    }
    // A play abbreviation at the start of a line continues a citation list.
    if (PLAYS.includes(groups['head'].replace(/[.\s]/g, ''))) {
      return [];
    }
    const pos = groups['pos'];
    const sep = groups['sep'] ?? '';
    return [
      {
        index,
        headword: groups['head'],
        key: headwordKey(groups['head']),
        partOfSpeech: pos ? PART_OF_SPEECH[pos] : undefined,
        // Keep an opening parenthesis: the note it starts is removed with the rest.
        body:
          (sep === '(' || sep === '{' ? '(' : sep === ':' ? ': ' : '') +
          line.slice(match[0].length),
      },
    ];
  });
  const run = alphabeticalRun(candidates.map((c) => c.key));
  const starts = new Map(candidates.filter((_, i) => run.has(i)).map((c) => [c.index, c]));

  const entries: { headword: string; partOfSpeech: PartOfSpeech | undefined; lines: string[] }[] =
    [];
  lines.forEach((line, index) => {
    const start = starts.get(index);
    if (start) {
      entries.push({
        headword: start.headword,
        partOfSpeech: start.partOfSpeech,
        lines: [start.body],
      });
    } else {
      entries.at(-1)?.lines.push(line);
    }
  });
  return entries.map(({ headword, partOfSpeech, lines: body }) => ({
    headword,
    partOfSpeech,
    senses: parseSenses(headword, body),
  }));
}

/** Joins lines, undoing line-end hyphenation. */
function join(lines: readonly string[]): string {
  let text = '';
  for (const line of lines) {
    if (text.endsWith('-') && /^[a-z]/.test(line)) {
      text = text.slice(0, -1) + line;
    } else {
      text = text === '' ? line : `${text} ${line}`;
    }
  }
  return text;
}

/** Removes balanced (…) and {…} groups; the OCR sometimes reads "(" as "{". */
function withoutParentheticals(text: string): string {
  let result = '';
  let depth = 0;
  for (const char of text) {
    if (char === '(' || char === '{') {
      depth += 1;
    } else if ((char === ')' || char === '}') && depth > 0) {
      depth -= 1;
    } else if (depth === 0) {
      result += char;
    }
  }
  return result;
}

/** Splits an entry's lines into numbered senses ("1 …", "2 …") or a single ": …" sense. */
function parseSenses(headword: string, lines: readonly string[]): Sense[] {
  const groups: { label: string | undefined; lines: string[] }[] = [
    { label: undefined, lines: [] },
  ];
  let expected = 1;
  for (const line of lines) {
    const numbered = /^(\d{1,2})\s+(?=[a-z=('‘"])(.*)$/.exec(line);
    if (numbered && Number(numbered[1]) === expected) {
      groups.push({ label: numbered[1], lines: [numbered[2] ?? ''] });
      expected += 1;
    } else {
      groups.at(-1)?.lines.push(line);
    }
  }
  return groups.flatMap(({ label, lines: senseLines }) => {
    let text = withoutParentheticals(join(senseLines))
      .replace(/\[[^\]]*\]/g, ' ') // alternative references
      // A ¶ note runs to the end; the OCR reads the sign as "%", "^[", "•[}", "^J" or "-fj".
      .replace(/\s(?:%|¶|\^\[|\^J|-fj|•\s*\[\}?|•)\s.*$/, '');
    if (label === undefined) {
      // Unnumbered text is a sense only after a colon; otherwise it was the entry's note.
      const colon = /^\s*:\s*/.exec(text);
      if (!colon) {
        return [];
      }
      text = text.slice(colon[0].length);
    }
    return parseSenseText(headword, label, text);
  });
}

// ---------------------------------------------------------------------------------------------
// Senses and citations

const PLAY_PATTERN = PLAYS.map((name) =>
  // Allow the printed dots and spaces: "All'sW.", "Mer. V.", "Tw.N."
  name
    .split('')
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(String.raw`\.?\s?`),
)
  .sort((a, b) => b.length - a.length)
  .join('|');

const ROMAN_TOKEN = String.raw`[ivxlnmhuyIVXL1|]{1,5}`;
const LINE_TOKEN = String.raw`\d[\dlIO]{0,3}`;

const TOKEN = new RegExp(
  [
    String.raw`(?<play>(?<![A-Za-z0-9])(?:${PLAY_PATTERN})(?![A-Za-z]))\.?`,
    String.raw`(?<part>\b(?:Prol|Epil|Chor|Ind))\.(?:\s*(?<partLine>${LINE_TOKEN})\b)?`,
    String.raw`(?<act>(?<![\w])${ROMAN_TOKEN})\.\s*(?<scene>${ROMAN_TOKEN})\.\s*(?<line>${LINE_TOKEN})\b`,
    String.raw`(?<num>(?<![\w.])${LINE_TOKEN})\b(?!\.\s*[a-z])`,
    String.raw`(?<semicolon>[;])`,
    String.raw`(?<word>[^\s;]+)`,
  ].join('|'),
  'g',
);

/** Expands the headword's abbreviations in a quotation: "A." → "Abate", "a-d" → "abated". */
export function expandHeadword(text: string, headword: string): string {
  const initial = headword.slice(0, 1).toLowerCase();
  if (!initial) {
    return text;
  }
  const capitalized = initial.toUpperCase() + headword.slice(1);
  return text
    .replace(
      /(^|[\s(])([A-Za-z])-([a-z]{1,4})\b/g,
      (whole, before: string, letter: string, suffix: string) =>
        letter.toLowerCase() === initial ? `${before}${headword}${suffix}` : whole,
    )
    .replace(/(^|[\s(])([A-Za-z])\.(?=[\s,;:!?]|$)/g, (whole, before: string, letter: string) =>
      letter.toLowerCase() === initial
        ? `${before}${letter === letter.toUpperCase() ? capitalized : headword}`
        : whole,
    );
}

function cleanGloss(gloss: string, headword: string): string {
  const cleaned = expandHeadword(gloss, headword)
    .replace(/\s+/g, ' ')
    .replace(/^[\s=,;:—–-]+/, '')
    // Grammatical labels before the meaning: "adv. with direct aim", "intr. to go astray".
    .replace(/^(?:(?:adv|adj|sb|vb|intr|trans|tr|refl|absol|pl|pi|ppl|pple)\.\s*)+/i, '')
    .replace(/[\s,;:.&]+(?:&c)?[\s,;:.]*$/, '')
    .replace(/\b(?:freq|usu|esp)\.?\s*$/i, '')
    .trim();
  return /[A-Za-z]{3,}/.test(cleaned) ? cleaned : '';
}

/**
 * Reads a sense's text: its gloss runs to the first citation; each citation takes the words
 * after it as its quotation. After a semicolon, words before the next citation start a new
 * gloss for the citations that follow ("…; mortal coil, bustle or turmoil … Ham. iii. i. 67").
 */
function parseSenseText(headword: string, label: string | undefined, text: string): Sense[] {
  const senses: Sense[] = [];
  let sense: Sense | undefined;
  let words: string[] = [];
  let afterSemicolon = true; // the gloss before the first citation
  let play: string | undefined;
  let act: number | null = null;
  let scene: number | null = null;
  let part: Citation['part'];
  let last: Citation | undefined;
  let compare = false; // within "cf. …": related passages, not examples of this sense

  /** Words since the last citation: its quotation, or a new gloss after a semicolon. */
  const settleWords = () => {
    const pending = words.join(' ').trim();
    words = [];
    if (afterSemicolon && pending !== '' && !/^cf\b/i.test(pending)) {
      sense = { label, gloss: cleanGloss(pending, headword), citations: [] };
      senses.push(sense);
      last = undefined;
    } else if (last && pending !== '') {
      last.quote = expandHeadword(pending, headword).replace(/[\s,;:.]+$/, '');
    }
    afterSemicolon = false;
  };

  const emit = (line: number) => {
    settleWords();
    if (!play || compare || !sense) {
      last = undefined;
      return;
    }
    last = { play, act, scene, ...(part ? { part } : {}), line, quote: '' };
    sense.citations.push(last);
  };

  for (const match of text.matchAll(TOKEN)) {
    const groups = match.groups ?? {};
    if (groups['play']) {
      settleWords();
      play = groups['play'].replace(/[.\s]/g, '');
      act = null;
      scene = null;
      part = undefined;
    } else if (groups['part']) {
      part =
        groups['part'] === 'Prol' ? 'prologue' : groups['part'] === 'Epil' ? 'epilogue' : undefined;
      const line = groups['partLine'] ? readLineNumber(groups['partLine']) : undefined;
      if (part && line !== undefined) {
        emit(line);
      } else {
        settleWords();
        play = part ? play : undefined; // inductions and choruses are not in the corpus
      }
    } else if (groups['act'] !== undefined) {
      const a = readOnionsRoman(groups['act']);
      const s = readOnionsRoman(groups['scene'] ?? '');
      const line = readLineNumber(groups['line'] ?? '');
      if (a !== undefined && s !== undefined && a <= 5 && line !== undefined) {
        act = a;
        scene = s;
        part = undefined;
        emit(line);
      } else {
        words.push(match[0]);
      }
    } else if (groups['num'] !== undefined && play && (act !== null || part)) {
      const line = readLineNumber(groups['num']);
      if (line !== undefined && words.join(' ').trim().replace(/[,\s]/g, '') === '') {
        emit(line); // "Ham. iii. i. 169, 175": more lines of the same scene
      } else {
        words.push(groups['num']);
      }
    } else if (groups['semicolon']) {
      settleWords();
      afterSemicolon = true;
      compare = false;
    } else {
      const word = groups['word'] ?? groups['num'] ?? '';
      if (/^cf\.?$/i.test(word)) {
        settleWords();
        compare = true;
      } else {
        words.push(word);
      }
    }
  }
  settleWords();
  return senses.filter((s) => s.gloss !== '' || s.citations.length > 0);
}
