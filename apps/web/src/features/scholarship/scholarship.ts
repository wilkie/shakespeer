/**
 * Scholarship in the reader (SCH-020 – SCH-033): the snapshot's works for chosen lines, the live
 * lookup from the browser, and works as citations.
 */
import {
  HUMANITIES_FIELD,
  linePhrases,
  parseWork,
  titleKey,
  workUrl,
  worksQueryUrl,
  type AlignmentFile,
  type ScholarshipFile,
  type ScholarshipWork,
  type VersionDocument,
} from '@shakespeer/corpus';
import type { Citation } from '@shakespeer/storage';

import { parseName } from '@/features/notes/citations';

/** A line of the version shown, by ID and number. */
export interface ChosenLine {
  id: string;
  n: string;
}

/** A work and the chosen lines it quotes. */
export interface ScholarshipItem {
  work: ScholarshipWork;
  lines: ChosenLine[];
}

/** Works quoting more of the selection first, then the most recent (SCH-021). */
function order(items: ScholarshipItem[]): ScholarshipItem[] {
  return items.sort(
    (a, b) =>
      b.lines.length - a.lines.length ||
      (b.work.year ?? 0) - (a.work.year ?? 0) ||
      a.work.title.localeCompare(b.work.title),
  );
}

/** The snapshot's works quoting any of the chosen lines (SCH-020). */
export function snapshotItems(
  file: ScholarshipFile | undefined,
  lines: readonly ChosenLine[],
): ScholarshipItem[] {
  if (!file) {
    return [];
  }
  const items = new Map<string, ScholarshipItem>();
  for (const line of lines) {
    for (const id of file.lines[line.id] ?? []) {
      const work = file.works[id];
      if (work) {
        const item = items.get(id) ?? { work, lines: [] };
        item.lines.push(line);
        items.set(id, item);
      }
    }
  }
  return order([...items.values()]);
}

/** At most this many lines are looked up per request (SCH-031). */
export const LIVE_LINE_LIMIT = 20;

/** A chosen line with the phrase it is looked up by (SCH-001). */
export interface LookupLine extends ChosenLine {
  phrase: string;
}

export class LookupError extends Error {
  constructor(readonly kind: 'offline' | 'limit' | 'error') {
    super(kind);
    this.name = 'LookupError';
  }
}

/**
 * The live lookup (SCH-030): asks OpenAlex, from the browser and with no key, for works quoting
 * each line's phrase, keeping humanities works that are neither reprints nor already shown.
 */
export async function liveLookup(
  lines: readonly LookupLine[],
  { reprints, shown }: { reprints: ReadonlySet<string>; shown: readonly ScholarshipWork[] },
  fetchImpl: typeof fetch = fetch,
): Promise<ScholarshipItem[]> {
  const known = new Set([...shown.map((w) => w.id), ...shown.map((w) => titleKey(w.title))]);
  const items = new Map<string, ScholarshipItem>();
  for (const line of lines.slice(0, LIVE_LINE_LIMIT)) {
    let response: Response;
    try {
      response = await fetchImpl(worksQueryUrl(line.phrase));
    } catch {
      throw new LookupError(navigator.onLine ? 'error' : 'offline');
    }
    if (response.status === 429) {
      throw new LookupError('limit');
    }
    if (!response.ok) {
      throw new LookupError('error');
    }
    const body = (await response.json()) as { results?: unknown[] };
    for (const found of (body.results ?? []).map(parseWork)) {
      const key = titleKey(found.title) || found.id;
      if (
        found.field !== HUMANITIES_FIELD ||
        reprints.has(found.id) ||
        known.has(found.id) ||
        known.has(key)
      ) {
        continue;
      }
      const { field: _field, ...work } = found;
      const item = items.get(key) ?? { work, lines: [] };
      if (!item.lines.some((l) => l.id === line.id)) {
        item.lines.push({ id: line.id, n: line.n });
      }
      items.set(key, item);
    }
  }
  return order([...items.values()]);
}

const CITATION_TYPES: Record<string, Citation['type']> = {
  article: 'article-journal',
  review: 'article-journal',
  'book-review': 'article-journal',
  'book-chapter': 'chapter',
  book: 'book',
};

/** A work as a citation, for Cite in a note (SCH-032). */
export function workCitation(work: ScholarshipWork): Citation {
  const doi = work.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  return {
    type: CITATION_TYPES[work.type] ?? 'document',
    title: work.title,
    ...(work.authors.length > 0 ? { author: work.authors.map(parseName) } : {}),
    ...(work.year ? { issued: { 'date-parts': [[work.year]] } } : {}),
    ...(work.venue ? { 'container-title': work.venue } : {}),
    ...(doi ? { DOI: doi } : {}),
    URL: workUrl(work),
  };
}

const TYPE_LABELS: Record<string, string> = {
  article: 'Article',
  'book-chapter': 'Chapter',
  book: 'Book',
  dissertation: 'Dissertation',
  review: 'Review',
  'book-review': 'Review',
};

/** How a work's type reads in the panel (SCH-021). */
export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

/** The first three authors, then "et al." (SCH-021). */
export function authorList(authors: readonly string[]): string {
  return authors.length > 3 ? `${authors.slice(0, 3).join(', ')} et al.` : authors.join(', ');
}

/** A version's speeches as lists of lines, for phrases that join short lines (SCH-001). */
export function speechLines(doc: VersionDocument): { id: string; text: string }[][] {
  return doc.divisions.flatMap((act) =>
    act.scenes.flatMap((scene) =>
      scene.blocks.flatMap((block) =>
        block.type === 'speech'
          ? [
              block.nodes
                .filter((node) => node.kind === 'line')
                .map(({ id, text }) => ({ id, text })),
            ]
          : [],
      ),
    ),
  );
}

/**
 * The chosen lines with the phrases to look up (SCH-030): their own for the modern version; for
 * an original version, the phrase of the first modern line each aligns to.
 */
export function lookupLinesFor(
  lines: readonly ChosenLine[],
  modern: VersionDocument,
  alignment: AlignmentFile | undefined,
): LookupLine[] {
  const phrases = linePhrases(speechLines(modern));
  const modernOf = new Map<string, readonly string[]>();
  for (const entry of alignment?.entries ?? []) {
    for (const id of entry.orig) {
      modernOf.set(id, entry.modern);
    }
  }
  return lines.flatMap((line) => {
    const candidates = alignment ? (modernOf.get(line.id) ?? []) : [line.id];
    const phrase = candidates.map((id) => phrases.get(id)).find(Boolean);
    return phrase ? [{ ...line, phrase }] : [];
  });
}
