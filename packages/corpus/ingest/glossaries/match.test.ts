import { describe, expect, it } from '@jest/globals';

import type { LineNode, VersionDocument } from '../../src/schema.ts';
import { matchCitations, type GlossCitation } from './match.ts';

const line = (n: number, text: string): LineNode => ({
  id: `ftln-${String(n).padStart(4, '0')}`,
  kind: 'line',
  text,
  form: 'verse',
  n: `3.1.${String(n)}`,
});

const doc: VersionDocument = {
  schemaVersion: 1,
  playId: 'hamlet',
  versionId: 'folger',
  revision: 'sha256:0000000000000000',
  characters: [],
  divisions: [
    {
      n: 3,
      editorial: false,
      scenes: [
        {
          id: '3.1',
          kind: 'scene',
          n: 1,
          editorial: false,
          blocks: [
            {
              type: 'speech',
              speakers: [],
              label: 'HAMLET',
              nodes: [
                line(80, 'When he himself might his quietus make'),
                line(81, 'With a bare bodkin? Who would fardels bear,'),
                line(82, 'To grunt and sweat under a weary life,'),
                line(95, 'Thy bodkin and thy bare blade'),
              ],
            },
          ],
        },
      ],
    },
  ],
};

const citation = (overrides: Partial<GlossCitation>): GlossCitation => ({
  headword: 'Bodkin',
  definition: { meaning: 'a sharp instrument' },
  act: 3,
  scene: 1,
  line: 76,
  quote: 'when he himself might his quietus make with a bare b',
  ...overrides,
});

describe('matchCitations', () => {
  it('CRP-071: anchors a cited occurrence confirmed by its quotation', () => {
    const { terms, report } = matchCitations(doc, 'schmidt-1902', [citation({})]);

    expect(report.matched).toBe(1);
    expect(terms).toStrictEqual([
      {
        id: 'schmidt-1902:ftln-0081:12',
        headword: 'Bodkin',
        definitions: [{ meaning: 'a sharp instrument' }],
        anchor: {
          start: { nodeId: 'ftln-0081', offset: 12 },
          end: { nodeId: 'ftln-0081', offset: 18 },
          quote: {
            exact: 'bodkin',
            prefix: 'With a bare ',
            suffix: '? Who would fardels b'.slice(0, 20),
          },
          revision: 'sha256:0000000000000000',
        },
      },
    ]);
  });

  it('CRP-071: skips citations whose quotation disagrees with the text', () => {
    const { report } = matchCitations(doc, 'schmidt-1902', [
      citation({ quote: 'stabbed through the arras with a b' }),
    ]);

    expect(report.unmatched.map((u) => u.reason)).toStrictEqual(['quotation disagrees']);
  });

  it('CRP-071: skips ambiguous citations without a usable quotation', () => {
    const { report } = matchCitations(doc, 'schmidt-1902', [citation({ line: 88, quote: '' })]);

    expect(report.unmatched.map((u) => u.reason)).toStrictEqual(['ambiguous']);
  });

  it('reports citations to scenes that do not exist', () => {
    const { report } = matchCitations(doc, 'schmidt-1902', [
      citation({ act: 2, scene: 9, quote: '' }),
    ]);

    expect(report.unmatched.map((u) => u.reason)).toStrictEqual(['no such scene']);
  });

  it('CRP-071a: recovers a misread scene number by its quotation alone', () => {
    // "II. 4" for III. 1.
    const { terms, report } = matchCitations(doc, 'schmidt-1902', [citation({ act: 2, scene: 4 })]);

    expect(report).toMatchObject({ matched: 1, recovered: 1, unmatched: [] });
    expect(terms.map((t) => t.id)).toStrictEqual(['schmidt-1902:ftln-0081:12']);
  });

  it('CRP-071a: recovers nothing without a quotation that singles out one line', () => {
    const { report } = matchCitations(doc, 'schmidt-1902', [
      citation({ act: 2, scene: 4, quote: 'a bare b' }),
      citation({ line: 400, quote: '' }),
    ]);

    expect(report.recovered).toBe(0);
    expect(report.unmatched.map((u) => u.reason)).toStrictEqual([
      'no such scene',
      'headword not found near cited line',
    ]);
  });

  it('CRP-071a: recovery can be turned off', () => {
    const { report } = matchCitations(
      doc,
      'schmidt-1902',
      [citation({ act: 2, scene: 4 })],
      undefined,
      { recover: false },
    );

    expect(report.unmatched.map((u) => u.reason)).toStrictEqual(['no such scene']);
  });
});
