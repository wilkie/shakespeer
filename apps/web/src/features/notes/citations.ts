/**
 * Citations (ANN-004 – ANN-006): parsing pasted BibTeX, RIS or CSL-JSON into the stored CSL-JSON
 * subset, and formatting citations for display.
 */
import type { Citation, CitationName } from '@shakespeer/storage';

// ---------------------------------------------------------------------------------------------
// Names and dates

/** "Schmidt, Alexander", "Alexander Schmidt", or "{Folger Shakespeare Library}" (literal). */
export function parseName(raw: string): CitationName {
  const name = raw.trim();
  if (/^\{.*\}$/.test(name)) {
    return { literal: cleanText(name) };
  }
  const cleaned = cleanText(name);
  const comma = cleaned.indexOf(',');
  if (comma >= 0) {
    const given = cleaned.slice(comma + 1).trim();
    return given
      ? { family: cleaned.slice(0, comma).trim(), given }
      : { family: cleaned.slice(0, comma).trim() };
  }
  const parts = cleaned.split(/\s+/);
  const family = parts.pop() ?? cleaned;
  return parts.length > 0 ? { family, given: parts.join(' ') } : { literal: family };
}

function issued(year: string | undefined, month?: string, day?: string): Citation['issued'] {
  const y = Number(/\d{4}/.exec(year ?? '')?.[0]);
  if (!y) {
    return undefined;
  }
  const m = Number(month);
  const d = Number(day);
  const parts: [number, number?, number?] = m ? (d ? [y, m, d] : [y, m]) : [y];
  return { 'date-parts': [parts] };
}

/** Removes BibTeX braces and simple LaTeX escapes. */
function cleanText(text: string): string {
  return text
    .replace(/\\[`'^"~=.]\{?([A-Za-z])\}?/g, '$1')
    .replace(/\\&/g, '&')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(citation: Citation): Citation {
  return Object.fromEntries(
    Object.entries(citation).filter(
      ([, value]) =>
        value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0),
    ),
  ) as unknown as Citation;
}

// ---------------------------------------------------------------------------------------------
// BibTeX

const BIBTEX_TYPES: Record<string, Citation['type']> = {
  article: 'article-journal',
  book: 'book',
  inbook: 'chapter',
  incollection: 'chapter',
  online: 'webpage',
  www: 'webpage',
};

function readBibtexValue(text: string, start: number): { value: string; end: number } {
  let i = start;
  while (/\s/.test(text[i] ?? '')) {
    i += 1;
  }
  const open = text[i];
  if (open === '{' || open === '"') {
    const close = open === '{' ? '}' : '"';
    let depth = 0;
    for (let j = i; j < text.length; j += 1) {
      const c = text[j];
      if (c === '{') {
        depth += 1;
      } else if (c === '}') {
        depth -= 1;
      }
      if (
        (close === '}' && depth === 0 && c === '}') ||
        (close === '"' && j > i && c === '"' && depth === 0)
      ) {
        return { value: text.slice(i + 1, j), end: j + 1 };
      }
    }
    return { value: text.slice(i + 1), end: text.length };
  }
  const match = /^[^,}]*/.exec(text.slice(i));
  const raw = match?.[0] ?? '';
  return { value: raw.trim(), end: i + raw.length };
}

export function parseBibtex(text: string): Citation[] {
  const citations: Citation[] = [];
  const entry = /@(\w+)\s*\{\s*[^,]*,/g;
  for (let match = entry.exec(text); match; match = entry.exec(text)) {
    const fields: Record<string, string> = {};
    let i = match.index + match[0].length;
    for (;;) {
      const field = /^\s*,?\s*(\w[\w-]*)\s*=/.exec(text.slice(i));
      if (!field?.[1]) {
        break;
      }
      const { value, end } = readBibtexValue(text, i + field[0].length);
      fields[field[1].toLowerCase()] = value;
      i = end;
    }
    entry.lastIndex = i;
    const title = cleanText(fields['title'] ?? '');
    if (!title) {
      continue;
    }
    const authors = (fields['author'] ?? fields['editor'] ?? '')
      .split(/\s+and\s+/)
      .filter((name) => name.trim() !== '')
      .map(parseName);
    citations.push(
      compact({
        type: BIBTEX_TYPES[(match[1] ?? '').toLowerCase()] ?? 'document',
        title,
        author: authors,
        issued: issued(fields['year'] ?? fields['date'], fields['month']),
        'container-title': cleanText(
          fields['journal'] ?? fields['journaltitle'] ?? fields['booktitle'] ?? '',
        ),
        publisher: cleanText(fields['publisher'] ?? ''),
        'publisher-place': cleanText(fields['address'] ?? fields['location'] ?? ''),
        volume: cleanText(fields['volume'] ?? ''),
        issue: cleanText(fields['number'] ?? fields['issue'] ?? ''),
        page: cleanText(fields['pages'] ?? '').replace(/-+/g, '–'),
        URL: cleanText(fields['url'] ?? ''),
        DOI: cleanText(fields['doi'] ?? ''),
        note: cleanText(fields['note'] ?? ''),
      }),
    );
  }
  return citations;
}

// ---------------------------------------------------------------------------------------------
// RIS

const RIS_TYPES: Record<string, Citation['type']> = {
  JOUR: 'article-journal',
  JFULL: 'article-journal',
  MGZN: 'article-journal',
  BOOK: 'book',
  EBOOK: 'book',
  CHAP: 'chapter',
  ECHAP: 'chapter',
  ELEC: 'webpage',
  WEB: 'webpage',
};

export function parseRis(text: string): Citation[] {
  const citations: Citation[] = [];
  let tags: Record<string, string[]> | undefined;
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/.exec(line);
    if (!match?.[1]) {
      continue;
    }
    const [, tag, value = ''] = match;
    if (tag === 'TY') {
      tags = { TY: [value.trim()] };
    } else if (tag === 'ER') {
      if (tags) {
        const citation = risCitation(tags);
        if (citation) {
          citations.push(citation);
        }
      }
      tags = undefined;
    } else if (tags) {
      (tags[tag] ??= []).push(value.trim());
    }
  }
  return citations;
}

function risCitation(tags: Record<string, string[]>): Citation | undefined {
  const first = (...names: string[]) =>
    names.map((n) => tags[n]?.[0]).find((v) => v !== undefined && v !== '');
  const title = first('TI', 'T1', 'CT');
  if (!title) {
    return undefined;
  }
  const date = first('PY', 'Y1', 'DA') ?? '';
  const [year, month, day] = date.split('/');
  const start = first('SP');
  const end = first('EP');
  return compact({
    type: RIS_TYPES[tags['TY']?.[0] ?? ''] ?? 'document',
    title,
    author: [...(tags['AU'] ?? []), ...(tags['A1'] ?? [])].map(parseName),
    issued: issued(year, month, day),
    'container-title': first('T2', 'JO', 'JF', 'BT'),
    publisher: first('PB'),
    'publisher-place': first('CY'),
    volume: first('VL'),
    issue: first('IS'),
    page: start ? (end ? `${start}–${end}` : start) : undefined,
    URL: first('UR'),
    DOI: first('DO'),
    note: first('N1'),
  });
}

// ---------------------------------------------------------------------------------------------
// CSL-JSON

const CSL_TYPES = new Set<Citation['type']>([
  'book',
  'chapter',
  'article-journal',
  'webpage',
  'document',
]);

function parseCslJson(text: string): Citation[] {
  const data: unknown = JSON.parse(text);
  const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
  return items.flatMap((item) => {
    const title = typeof item['title'] === 'string' ? item['title'] : '';
    if (!title) {
      return [];
    }
    const text = (key: string) =>
      typeof item[key] === 'string' || typeof item[key] === 'number'
        ? String(item[key])
        : undefined;
    const type = text('type') as Citation['type'] | undefined;
    return [
      compact({
        type: type && CSL_TYPES.has(type) ? type : 'document',
        title,
        author: Array.isArray(item['author']) ? (item['author'] as CitationName[]) : undefined,
        issued: item['issued'] as Citation['issued'],
        'container-title': text('container-title'),
        publisher: text('publisher'),
        'publisher-place': text('publisher-place'),
        volume: text('volume'),
        issue: text('issue'),
        page: text('page'),
        URL: text('URL'),
        DOI: text('DOI'),
        note: text('note'),
      }),
    ];
  });
}

/**
 * Parses pasted citations in BibTeX, RIS or CSL-JSON, as exported by digital libraries and
 * reference managers (ANN-005). Several entries become several citations.
 */
export function parseCitationText(text: string): Citation[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('@')) {
    return parseBibtex(trimmed);
  }
  if (/^TY\s{1,2}-/m.test(trimmed)) {
    return parseRis(trimmed);
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return parseCslJson(trimmed);
    } catch {
      return [];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------------------------
// Display

export function formatName(name: CitationName): string {
  return 'literal' in name
    ? name.literal
    : name.given
      ? `${name.given} ${name.family}`
      : name.family;
}

function formatAuthors(names: readonly CitationName[]): string {
  const formatted = names.map(formatName);
  if (formatted.length <= 2) {
    return formatted.join(' and ');
  }
  return `${formatted.slice(0, -1).join(', ')}, and ${formatted.at(-1) ?? ''}`;
}

/** A citation's parts in a consistent, readable order (ANN-006). */
export function formatCitation(citation: Citation): { text: string; href: string | undefined } {
  const year = citation.issued?.['date-parts'][0]?.[0];
  const parts = [
    citation.author?.length ? formatAuthors(citation.author) : undefined,
    citation.type === 'book' ? citation.title : `“${citation.title}”`,
    citation['container-title'],
    [citation.volume, citation.issue && `(${citation.issue})`].filter(Boolean).join(' ') ||
      undefined,
    [citation.publisher, citation['publisher-place']].filter(Boolean).join(', ') || undefined,
    year === undefined ? undefined : String(year),
    citation.page && `pp. ${citation.page}`,
  ].filter((part): part is string => Boolean(part));
  const href = citation.DOI
    ? `https://doi.org/${citation.DOI.replace(/^https?:\/\/doi\.org\//, '')}`
    : citation.URL;
  return { text: `${parts.join('. ')}.`, href };
}
