/**
 * Finding scholarly works that quote a play's lines in OpenAlex's full-text index (SCH-001 –
 * SCH-004). Shared by the maintainer's snapshot script and the reader's live lookup, so both
 * look lines up the same way.
 */
import type { ScholarshipWork } from './schema';

/** Bump when phrases or filters change, so a snapshot is never mixed (SCH-011). */
export const SCHOLARSHIP_QUERY_VERSION = 1;

const MIN_WORDS = 6;
const MAX_WORDS = 12;

/** The field a work's primary topic must be in to be kept (SCH-002). */
export const HUMANITIES_FIELD = 'Arts and Humanities';

/** A line's words without punctuation, apostrophes kept ("th'", "'tis"). */
export function phraseWords(text: string): string[] {
  return text
    .replaceAll('’', "'")
    .replace(/[^\p{L}' ]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word !== '' && word !== "'");
}

/**
 * Each line's phrase (SCH-001): its words, joined with the following lines of its speech until
 * there are at least 6, cut at 12. Lines that cannot reach 6 words have none.
 */
export function linePhrases(
  speeches: readonly (readonly { id: string; text: string }[])[],
): Map<string, string> {
  const phrases = new Map<string, string>();
  for (const speech of speeches) {
    speech.forEach((line, i) => {
      let words = phraseWords(line.text);
      for (let j = i + 1; words.length < MIN_WORDS && j < speech.length; j++) {
        words = [...words, ...phraseWords(speech[j]?.text ?? '')];
      }
      if (words.length >= MIN_WORDS) {
        phrases.set(line.id, words.slice(0, MAX_WORDS).join(' '));
      }
    });
  }
  return phrases;
}

const FIELDS =
  'id,display_name,publication_year,doi,primary_topic,type,open_access,authorships,primary_location';

/** The OpenAlex request for works whose full text contains a phrase. */
export function worksQueryUrl(phrase: string, apiKey?: string): string {
  const filter = `fulltext.search:${encodeURIComponent(`"${phrase}"`)}`;
  const key = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
  return `https://api.openalex.org/works?filter=${filter}&per-page=50&select=${FIELDS}${key}`;
}

/** A work as found, with the field its primary topic is in (SCH-002). */
export interface FoundWork extends ScholarshipWork {
  field: string;
}

interface OpenAlexWork {
  id?: string;
  display_name?: string | null;
  publication_year?: number | null;
  doi?: string | null;
  type?: string | null;
  primary_topic?: { field?: { display_name?: string } } | null;
  open_access?: { oa_url?: string | null } | null;
  authorships?: { author?: { display_name?: string | null } }[] | null;
  primary_location?: { source?: { display_name?: string | null } | null } | null;
}

/** Reads one work of an OpenAlex response (SCH-004). */
export function parseWork(raw: unknown): FoundWork {
  const work = raw as OpenAlexWork;
  const authors = (work.authorships ?? [])
    .map((a) => a.author?.display_name ?? '')
    .filter((name) => name !== '');
  const venue = work.primary_location?.source?.display_name;
  return {
    id: (work.id ?? '').replace('https://openalex.org/', ''),
    title: work.display_name ?? '',
    authors,
    ...(typeof work.publication_year === 'number' ? { year: work.publication_year } : {}),
    ...(venue ? { venue } : {}),
    type: work.type ?? 'other',
    ...(work.doi ? { doi: work.doi } : {}),
    ...(work.open_access?.oa_url ? { oaUrl: work.open_access.oa_url } : {}),
    field: work.primary_topic?.field?.display_name ?? '',
  };
}

/** Records of the same work share a title, ignoring case and punctuation (SCH-003). */
export function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Where a work's title links to (SCH-021): its open-access copy, else its DOI, else OpenAlex. */
export function workUrl(work: ScholarshipWork): string {
  return work.oaUrl ?? work.doi ?? `https://openalex.org/${work.id}`;
}
