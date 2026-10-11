import { describe, expect, it } from '@jest/globals';

import { doc } from './fixture.ts';
import {
  GeneratedFileSchema,
  checkGenerated,
  formatGeneratedFile,
  reviewSample,
  type GeneratedEntry,
  type GeneratedFile,
} from './file.ts';

const entry = (overrides: Partial<GeneratedEntry> = {}): GeneratedEntry => ({
  nodeId: 'ftln-0001',
  start: 17,
  end: 21,
  word: 'yare',
  meaning: 'quick, nimble',
  partOfSpeech: 'adjective',
  status: 'reviewed',
  ...overrides,
});

const generated = (entries: GeneratedEntry[]): GeneratedFile => ({
  model: 'claude-opus-5-5',
  generatedAt: '2026-10-11',
  promptVersion: 1,
  entries,
  notNeeded: [],
});

describe('checkGenerated', () => {
  it('GEN-020/030: ships checked entries as sourced terms under source ID generated', () => {
    const { terms, report } = checkGenerated(doc, generated([entry()]));
    expect(report.withheld).toBeUndefined();
    expect(terms).toEqual([
      {
        id: 'generated:ftln-0001:17',
        anchor: {
          start: { nodeId: 'ftln-0001', offset: 17 },
          end: { nodeId: 'ftln-0001', offset: 21 },
          quote: { exact: 'yare', prefix: 'Good Gonzalo, be ', suffix: ' and tend the master' },
          revision: doc.revision,
        },
        headword: 'yare',
        definitions: [{ meaning: 'quick, nimble', partOfSpeech: 'adjective' }],
      },
    ]);
  });

  it('GEN-020: drops and reports entries that fail a check', () => {
    const { terms, report } = checkGenerated(
      doc,
      generated([
        entry(),
        entry({ start: 18, end: 22 }), // span moved
        entry({ nodeId: 'ftln-0002', start: 6, end: 10, meaning: '  ' }),
        entry({ nodeId: 'ftln-0002', start: 0, end: 4, word: 'Yare', meaning: 'x'.repeat(201) }),
        entry({ nodeId: 'ftln-0005', start: 28, end: 32, word: 'wilt', meaning: '“Wilt.”' }),
      ]),
    );
    expect(report.dropped.map((d) => d.reason)).toEqual([
      'span is not the word',
      'empty meaning',
      'meaning too long',
      'meaning repeats the word',
    ]);
    expect(terms.map((t) => t.id)).toEqual(['generated:ftln-0001:17']);
  });

  it('GEN-021/022: withholds a set until its sample is reviewed, and if over 10% is rejected', () => {
    const unreviewed = checkGenerated(doc, generated([entry(), entry({ status: 'auto' })]));
    expect(unreviewed.report.counts).toEqual({ auto: 1, reviewed: 1, rejected: 0 });
    expect(unreviewed.report.withheld).toMatch(/1 of the 2 sampled entries not yet reviewed/);
    expect(unreviewed.terms).toEqual([]);
    expect(checkGenerated(doc, generated([])).report.withheld).toBe('no entries');

    // 150 lines of "yare": the sample is 100 of them, chosen the same way every time.
    const lines = Array.from({ length: 150 }, (_, i) => ({
      id: `ftln-${String(i + 1).padStart(4, '0')}`,
      kind: 'line' as const,
      text: 'yare',
      form: 'verse' as const,
    }));
    const big = structuredClone(doc);
    const block = big.divisions[0]?.scenes[0]?.blocks[1];
    if (block?.type === 'speech') {
      block.nodes = lines;
    }
    const entries = lines.map((l) => entry({ nodeId: l.id, start: 0, end: 4, status: 'reviewed' }));
    const sample = reviewSample(entries);
    expect(sample).toHaveLength(100);
    expect(reviewSample([...entries].reverse())).toEqual(sample);

    const rejecting = (count: number) => {
      const chosen = new Set(sample.slice(0, count).map((e) => e.nodeId));
      return entries.map((e) => (chosen.has(e.nodeId) ? { ...e, status: 'rejected' as const } : e));
    };
    const passing = checkGenerated(big, generated(rejecting(10)));
    expect(passing.report.withheld).toBeUndefined();
    expect(passing.report.counts).toEqual({ auto: 0, reviewed: 140, rejected: 10 });
    expect(passing.terms).toHaveLength(140);
    expect(checkGenerated(big, generated(rejecting(11))).report.withheld).toMatch(
      /11 of the 100 sampled entries rejected/,
    );
  });
});

describe('formatGeneratedFile', () => {
  it('GEN-013: writes one entry per line and reads back the same', () => {
    const file: GeneratedFile = {
      ...generated([entry(), entry({ nodeId: 'ftln-0002', start: 6, end: 10, status: 'auto' })]),
      notNeeded: [{ nodeId: 'ftln-0002', start: 0, end: 4, word: 'Yare' }],
    };
    const text = formatGeneratedFile(file);
    expect(text.split('\n').filter((l) => l.includes('"nodeId"'))).toHaveLength(3);
    expect(GeneratedFileSchema.parse(JSON.parse(text))).toEqual(file);
  });
});
