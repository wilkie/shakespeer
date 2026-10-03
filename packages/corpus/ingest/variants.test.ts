import { describe, expect, it } from '@jest/globals';

import type { AlignmentEntry, TextNode, VersionDocument } from '../src/schema.ts';
import { seedVariants, versionsLacking } from './variants.ts';

const doc = (versionId: string, nodes: TextNode[]): VersionDocument => ({
  schemaVersion: 1,
  playId: 'hamlet',
  versionId,
  revision: '',
  characters: [],
  divisions: [
    {
      n: 1,
      editorial: false,
      scenes: [
        {
          id: '1.1',
          kind: 'scene',
          n: 1,
          editorial: false,
          blocks: [{ type: 'speech', speakers: [], label: '', nodes }],
        },
      ],
    },
  ],
});
const line = (id: string, text: string, n?: string): TextNode => ({
  id,
  kind: 'line',
  text,
  form: 'verse',
  ...(n ? { n } : {}),
});

describe('versionsLacking', () => {
  it.each([
    ['text from the Folio not found in the Second Quarto', ['q2-1604']],
    ['lines from the Second Quarto not found in the Folio', ['f1-1623']],
    ['editorial emendation', []],
  ])('CRP-061: %s', (description, lacking) => {
    expect([...versionsLacking(description, ['q1-1603', 'q2-1604', 'f1-1623'])]).toStrictEqual(
      lacking,
    );
  });

  it('reads an unqualified "Quarto" as the play\'s only quarto', () => {
    expect([
      ...versionsLacking('text from the Folio not found in the Quarto', ['q1-1609', 'f1-1623']),
    ]).toStrictEqual(['q1-1609']);
  });
});

describe('seedVariants', () => {
  const modern = doc('folger', [
    line('m1', 'And why such daily cast of brazen cannon', '1.1.84'),
    line('m2', 'I think it be no other but e’en so.', '1.1.120'),
  ]);
  const folio = doc('f1-1623', [
    line('f1', 'And why such dayly Cast of Brazon Cannon'),
    line('f2', 'I thinke it be'),
  ]);
  const entries: AlignmentEntry[] = [
    { orig: ['f1'], modern: ['m1'], relation: 'variant', status: 'auto' },
    // The aligner wrongly pairs the Quarto-only line with a Folio line sharing words.
    { orig: ['f2'], modern: ['m2'], relation: 'variant', status: 'auto' },
  ];
  const tokens = new Map([
    ['w1', { nodeId: 'm1', start: 19, end: 23 }],
    ['w2', { nodeId: 'm2', start: 0, end: 7 }],
    ['w3', { nodeId: 'm2', start: 8, end: 35 }],
  ]);
  const { variants, report } = seedVariants(
    modern,
    tokens,
    [
      {
        id: 'ptr-1',
        description: 'text from the Folio not found in the Second Quarto',
        kind: 'texta',
        tokens: ['w1'],
      },
      {
        id: 'ptr-2',
        description: 'lines from the Second Quarto not found in the Folio',
        kind: 'textb',
        tokens: ['w2', 'w3'],
      },
      { id: 'ptr-3', description: 'editorial emendation', kind: 'emend', tokens: ['w-heading'] },
    ],
    [{ doc: folio, entries }],
    { 'folger-ptr-1': 'Q2 reads *cost*.' },
  );

  it('CRP-061: seeds the modern reading and each original reading through alignment', () => {
    expect(variants[0]).toStrictEqual({
      id: 'folger-ptr-1',
      title: 'Text from the Folio not found in the Second Quarto: “cast” (1.1.84)',
      note: 'Q2 reads *cost*.',
      sourceIds: ['folger'],
      readings: [
        {
          versionId: 'folger',
          start: { nodeId: 'm1', offset: 19 },
          end: { nodeId: 'm1', offset: 23 },
          text: 'cast',
        },
        {
          versionId: 'f1-1623',
          start: { nodeId: 'f1', offset: 0 },
          end: { nodeId: 'f1', offset: 40 },
          text: 'And why such dayly Cast of Brazon Cannon',
        },
      ],
    });
  });

  it('trusts the edition over the aligner on which printing lacks a passage', () => {
    expect(variants[1]?.readings[1]).toStrictEqual({ versionId: 'f1-1623', text: '' });
  });

  it('skips marks outside the text (headings, speaker names)', () => {
    expect(report).toStrictEqual({ seeded: 2, skipped: 1 });
  });
});
