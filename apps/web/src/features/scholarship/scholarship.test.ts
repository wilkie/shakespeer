import { describe, expect, it, jest } from '@jest/globals';
import type { AlignmentFile, ScholarshipFile, VersionDocument } from '@shakespeer/corpus';

import {
  LookupError,
  authorList,
  liveLookup,
  lookupLinesFor,
  snapshotItems,
  workCitation,
} from './scholarship';

const work = (id: string, year: number, title = `Work ${id}`) => ({
  id,
  title,
  authors: ['A. Critic'],
  year,
  type: 'article',
});

const snapshot: ScholarshipFile = {
  schemaVersion: 1,
  playId: 'the-tempest',
  versionId: 'folger',
  retrievedAt: '2026-11-11',
  lines: { L1: ['W1', 'W2'], L2: ['W2', 'W3'] },
  works: { W1: work('W1', 2020), W2: work('W2', 1990), W3: work('W3', 2010) },
  reprints: ['W-ED'],
};

const lines = [
  { id: 'L1', n: '1.2.1' },
  { id: 'L2', n: '1.2.2' },
];

/** An OpenAlex response holding these raw works. */
const reply = (status: number, body: unknown = {}) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
const answer = (results: unknown[]) => reply(200, { results });

const raw = (id: string, field = 'Arts and Humanities', title = `Found ${id}`) => ({
  id: `https://openalex.org/${id}`,
  display_name: title,
  publication_year: 2015,
  type: 'article',
  primary_topic: { field: { display_name: field } },
});

describe('snapshotItems', () => {
  it('SCH-020/021: lists works quoting the chosen lines, most of the selection first, then newest', () => {
    const items = snapshotItems(snapshot, lines);
    expect(items.map((i) => [i.work.id, i.lines.map((l) => l.n)])).toEqual([
      ['W2', ['1.2.1', '1.2.2']],
      ['W1', ['1.2.1']],
      ['W3', ['1.2.2']],
    ]);
    expect(snapshotItems(undefined, lines)).toEqual([]);
  });
});

describe('liveLookup', () => {
  const lookup = lines.map((l) => ({ ...l, phrase: `phrase of ${l.id}` }));

  it('SCH-030: keeps new humanities works, dropping reprints and works already shown', async () => {
    const fetchImpl = jest.fn((url: string) =>
      url.includes('L1')
        ? answer([raw('W9'), raw('W-ED'), raw('W1'), raw('W-MED', 'Medicine')])
        : answer([raw('W9b', undefined, 'Found W9'), raw('W8')]),
    ) as unknown as typeof fetch;
    const items = await liveLookup(
      lookup,
      { reprints: new Set(['W-ED']), shown: [snapshot.works['W1'] ?? work('W1', 2020)] },
      fetchImpl,
    );
    // W9 and W9b are one work by title, found for both lines.
    expect(items.map((i) => [i.work.id, i.lines.map((l) => l.n)])).toEqual([
      ['W9', ['1.2.1', '1.2.2']],
      ['W8', ['1.2.2']],
    ]);
    // No key is sent (SCH-031).
    expect(String((fetchImpl as jest.Mock).mock.calls[0]?.[0])).not.toContain('api_key');
  });

  it('SCH-031: looks up at most 20 lines', async () => {
    const fetchImpl = jest.fn(() => answer([])) as unknown as typeof fetch;
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `L${String(i)}`,
      n: '',
      phrase: 'p',
    }));
    await liveLookup(many, { reprints: new Set(), shown: [] }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(20);
  });

  it('SCH-033: tells the daily limit from other failures', async () => {
    const limit = jest.fn(() => reply(429)) as unknown as typeof fetch;
    await expect(
      liveLookup(lookup, { reprints: new Set(), shown: [] }, limit),
    ).rejects.toMatchObject({ kind: 'limit' });
    const broken = jest.fn(() => reply(500)) as unknown as typeof fetch;
    await expect(
      liveLookup(lookup, { reprints: new Set(), shown: [] }, broken),
    ).rejects.toBeInstanceOf(LookupError);
    const down = jest.fn(() => Promise.reject(new TypeError('failed'))) as unknown as typeof fetch;
    await expect(
      liveLookup(lookup, { reprints: new Set(), shown: [] }, down),
    ).rejects.toMatchObject({ kind: navigator.onLine ? 'error' : 'offline' });
  });
});

describe('workCitation', () => {
  it('SCH-032: makes a citation of a work, linked to its copy', () => {
    expect(
      workCitation({
        id: 'W1',
        title: 'Caliban and Language',
        authors: ['Ann Smith'],
        year: 2017,
        venue: 'Shakespeare Quarterly',
        type: 'article',
        doi: 'https://doi.org/10.1/abc',
        oaUrl: 'https://example.org/a.pdf',
      }),
    ).toEqual({
      type: 'article-journal',
      title: 'Caliban and Language',
      author: [{ family: 'Smith', given: 'Ann' }],
      issued: { 'date-parts': [[2017]] },
      'container-title': 'Shakespeare Quarterly',
      DOI: '10.1/abc',
      URL: 'https://example.org/a.pdf',
    });
    expect(
      workCitation({ id: 'W2', title: 'A Thesis', authors: [], type: 'dissertation' }),
    ).toEqual({ type: 'document', title: 'A Thesis', URL: 'https://openalex.org/W2' });
  });

  it('SCH-021: lists the first three authors, then et al.', () => {
    expect(authorList(['A', 'B', 'C', 'D'])).toBe('A, B, C et al.');
    expect(authorList(['A', 'B'])).toBe('A, B');
  });
});

describe('lookupLinesFor', () => {
  const modern = {
    schemaVersion: 1,
    playId: 'the-tempest',
    versionId: 'folger',
    revision: 'r',
    characters: [],
    divisions: [
      {
        n: 1,
        editorial: false,
        scenes: [
          {
            id: '1.2',
            kind: 'scene',
            n: 2,
            editorial: false,
            blocks: [
              {
                type: 'speech',
                speakers: [],
                label: 'PROSPERO',
                nodes: [
                  {
                    id: 'm1',
                    kind: 'line',
                    text: 'Be collected. No more amazement.',
                    form: 'verse',
                  },
                  { id: 'm2', kind: 'line', text: 'Tell your piteous heart', form: 'verse' },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as VersionDocument;

  it('SCH-030: uses the modern line an original line aligns to', () => {
    const alignment = {
      entries: [{ orig: ['o1'], modern: ['m1'], relation: 'variant', status: 'auto' }],
    } as unknown as AlignmentFile;
    expect(lookupLinesFor([{ id: 'o1', n: '1.2.1' }], modern, alignment)).toEqual([
      { id: 'o1', n: '1.2.1', phrase: 'Be collected No more amazement Tell your piteous heart' },
    ]);
    expect(lookupLinesFor([{ id: 'm2', n: '1.2.2' }], modern, undefined)).toEqual([]);
  });
});
