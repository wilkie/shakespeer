import { describe, expect, it } from '@jest/globals';

import {
  SCHOLARSHIP_QUERY_VERSION,
  linePhrases,
  parseWork,
  workUrl,
  type FoundWork,
} from '../../src/scholarship.ts';
import type { LineNode, VersionDocument } from '../../src/schema.ts';
import {
  ScholarshipCurationSchema,
  buildScholarship,
  formatScholarshipCuration,
  type ScholarshipCuration,
} from './file.ts';
import { gatherScholarship, type FindWorks } from './gather.ts';

const line = (n: number, text: string): LineNode => ({
  id: `ftln-${String(n).padStart(4, '0')}`,
  kind: 'line',
  text,
  form: 'verse',
  n: `1.2.${String(n)}`,
});

/** Sixteen lines in two speeches; the second speech ends with a line too short to look up. */
const doc: VersionDocument = {
  schemaVersion: 1,
  playId: 'the-tempest',
  versionId: 'folger',
  revision: 'sha256:0000000000000000',
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
              speakers: ['Prospero_Tmp'],
              label: 'PROSPERO',
              nodes: Array.from({ length: 14 }, (_, i) =>
                line(i + 1, `This is line number ${String(i + 1)} of a longer speech,`),
              ),
            },
            {
              type: 'speech',
              speakers: ['Miranda_Tmp'],
              label: 'MIRANDA',
              nodes: [line(15, 'O, I have suffered'), line(16, 'Alack!')],
            },
          ],
        },
      ],
    },
  ],
};

const work = (id: string, overrides: Partial<FoundWork> = {}): FoundWork => ({
  id,
  title: `On The Tempest ${id}`,
  authors: ['A. Critic'],
  year: 2010,
  type: 'article',
  field: 'Arts and Humanities',
  ...overrides,
});

const curation = (overrides: Partial<ScholarshipCuration> = {}): ScholarshipCuration => ({
  retrievedAt: '2026-11-11',
  queryVersion: SCHOLARSHIP_QUERY_VERSION,
  lines: {},
  works: {},
  rejected: [],
  ...overrides,
});

describe('linePhrases', () => {
  it('SCH-001: joins short lines with the rest of their speech and cuts phrases at 12 words', () => {
    const phrases = linePhrases([
      [
        { id: 'a', text: 'O, I have suffered' },
        {
          id: 'b',
          text: 'With those that I saw suffer: a brave vessel, who had, no doubt, some noble creature',
        },
      ],
      [{ id: 'c', text: 'Alack!' }],
    ]);
    expect(phrases.get('a')).toBe('O I have suffered With those that I saw suffer a brave');
    expect(phrases.get('b')).toBe('With those that I saw suffer a brave vessel who had no');
    // Too short, with no following line in its speech.
    expect(phrases.has('c')).toBe(false);
  });
});

describe('parseWork', () => {
  it('SCH-004: keeps the work’s description and the field of its primary topic', () => {
    const parsed = parseWork({
      id: 'https://openalex.org/W123',
      display_name: 'Caliban and Language',
      publication_year: 2017,
      doi: 'https://doi.org/10.1/abc',
      type: 'article',
      primary_topic: { field: { display_name: 'Arts and Humanities' } },
      open_access: { oa_url: 'https://example.org/paper.pdf' },
      authorships: [
        { author: { display_name: 'Ann Smith' } },
        { author: { display_name: 'Bo Li' } },
      ],
      primary_location: { source: { display_name: 'Shakespeare Quarterly' } },
    });
    expect(parsed).toEqual({
      id: 'W123',
      title: 'Caliban and Language',
      authors: ['Ann Smith', 'Bo Li'],
      year: 2017,
      venue: 'Shakespeare Quarterly',
      type: 'article',
      doi: 'https://doi.org/10.1/abc',
      oaUrl: 'https://example.org/paper.pdf',
      field: 'Arts and Humanities',
    });
    // SCH-021: the open-access copy first, then the DOI, then OpenAlex.
    expect(workUrl(parsed)).toBe('https://example.org/paper.pdf');
    const { oaUrl: _oa, ...noCopy } = parsed;
    expect(workUrl(noCopy)).toBe('https://doi.org/10.1/abc');
    expect(workUrl({ id: 'W9', title: '', authors: [], type: 'book' })).toBe(
      'https://openalex.org/W9',
    );
  });
});

describe('buildScholarship', () => {
  it('SCH-002/003/012: keeps humanities works, drops reprints and rejected works, merges records', () => {
    const reprintLines = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [line(i + 4, '').id, ['W-REPRINT']]),
    );
    const { file, report } = buildScholarship(
      doc,
      curation({
        lines: {
          ...reprintLines,
          'ftln-0001': ['W-REPRINT', 'W2', 'W-MED'],
          'ftln-0002': ['W3', 'W3B', 'W-REJECTED'],
          'ftln-0003': [],
          'ftln-9999': ['W2'],
        },
        works: {
          'W-REPRINT': work('W-REPRINT', { title: 'An Acting Edition' }),
          W2: work('W2', { year: 2001 }),
          'W-MED': work('W-MED', { field: 'Medicine' }),
          W3: work('W3', { title: 'Same Work', year: 2020 }),
          W3B: work('W3B', { title: 'Same work.', year: 2020 }),
          'W-REJECTED': work('W-REJECTED'),
        },
        rejected: ['W-REJECTED'],
      }),
    );
    // 14 of the 16 lines can be looked up; the edition quoting 5 of them, over a quarter, is a reprint.
    expect(file.reprints).toEqual(['W-REPRINT']);
    expect(file.lines).toEqual({ 'ftln-0001': ['W2'], 'ftln-0002': ['W3'] });
    expect(Object.keys(file.works).sort()).toEqual(['W2', 'W3']);
    expect(file.works['W2']).not.toHaveProperty('field');
    expect(report).toMatchObject({
      lines: 9,
      linesWithWorks: 2,
      works: 2,
      dropped: { reprints: 1, outsideField: 1, rejected: 1, staleLines: 1 },
    });
  });

  it('SCH-021: orders a line’s works most recent first', () => {
    const { file } = buildScholarship(
      doc,
      curation({
        lines: { 'ftln-0001': ['W1', 'W2', 'W3'] },
        works: {
          W1: work('W1', { year: 1990 }),
          W2: work('W2', { year: 2020 }),
          W3: work('W3', { year: 2005 }),
        },
      }),
    );
    expect(file.lines['ftln-0001']).toEqual(['W2', 'W3', 'W1']);
  });
});

describe('formatScholarshipCuration', () => {
  it('SCH-011: writes one line or work per line of text and reads back the same', () => {
    const file = curation({
      lines: { 'ftln-0002': ['W1'], 'ftln-0001': [] },
      works: { W1: work('W1') },
      rejected: ['W9'],
    });
    const text = formatScholarshipCuration(file);
    expect(text.split('\n').filter((l) => l.includes('ftln-'))).toHaveLength(2);
    expect(ScholarshipCurationSchema.parse(JSON.parse(text))).toEqual(file);
  });
});

describe('gatherScholarship', () => {
  const finder = (answers: Record<string, FoundWork[] | undefined>) => {
    const asked: string[] = [];
    const findWorks: FindWorks = (phrase) => {
      asked.push(phrase);
      return Promise.resolve(phrase in answers ? answers[phrase] : []);
    };
    return { findWorks, asked };
  };

  it('SCH-010: looks up each line in range once, keeping lines without works and retrying failures', async () => {
    const phrase1 = 'This is line number of a longer speech';
    const { findWorks, asked } = finder({ [phrase1]: [work('W1')] });
    const saved: ScholarshipCuration[] = [];
    const result = await gatherScholarship({
      doc,
      existing: curation({ lines: { 'ftln-0002': [] } }),
      findWorks,
      save: (file) => {
        saved.push(structuredClone(file));
        return Promise.resolve();
      },
      today: '2026-11-11',
      include: (n) => n === '1.2.1' || n === '1.2.2' || n === '1.2.3',
    });
    // Line 2 was answered before; lines 1 and 3 are asked about now.
    expect(asked).toHaveLength(2);
    const file = saved.at(-1) as ScholarshipCuration;
    expect(Object.keys(file.lines).sort()).toEqual(['ftln-0001', 'ftln-0002', 'ftln-0003']);
    expect(result).toMatchObject({ asked: 2, failed: 0 });

    const failing: FindWorks = () => Promise.resolve(undefined);
    const retry = await gatherScholarship({
      doc,
      existing: undefined,
      findWorks: failing,
      save: () => Promise.resolve(),
      today: '2026-11-11',
      include: (n) => n === '1.2.4',
    });
    expect(retry.failed).toBe(1);
    expect(retry.file.lines).toEqual({});
  });

  it('SCH-011: refuses to extend a snapshot gathered with another query version', async () => {
    await expect(
      gatherScholarship({
        doc,
        existing: curation({ queryVersion: SCHOLARSHIP_QUERY_VERSION + 1 }),
        findWorks: () => Promise.resolve([]),
        save: () => Promise.resolve(),
        today: '2026-11-11',
      }),
    ).rejects.toThrow(/query version/);
  });
});
