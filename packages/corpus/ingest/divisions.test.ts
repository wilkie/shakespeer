import { describe, expect, it } from '@jest/globals';

import type { Block, Scene, VersionDocument } from '../src/schema.ts';
import { supplyEditorialDivisions } from './divisions.ts';

let counter = 0;
const sd = (text: string): Block => {
  counter += 1;
  return { type: 'sd', node: { id: `sd-${String(counter)}`, kind: 'sd', text } };
};
const speech = (text: string): Block => {
  counter += 1;
  return {
    type: 'speech',
    speakers: [],
    label: 'A.',
    nodes: [{ id: `l-${String(counter)}`, kind: 'line', text, form: 'verse' }],
  };
};
const scene = (n: number, blocks: Block[], editorial = false): Scene => ({
  id: `x.${String(n)}`,
  kind: 'scene',
  n,
  editorial,
  blocks,
});
const doc = (divisions: VersionDocument['divisions']): VersionDocument => ({
  schemaVersion: 1,
  playId: 'play',
  versionId: 'v',
  revision: '',
  characters: [],
  divisions,
});

const PASSAGES = [
  'the quality of mercy is not strained it droppeth as the gentle rain from heaven',
  'now is the winter of our discontent made glorious summer by this sun of york',
  'friends romans countrymen lend me your ears i come to bury caesar not to praise him',
];

describe('supplyEditorialDivisions', () => {
  it('CRP-031: splits a printed scene where the modern scenes begin, at entrances', () => {
    const modern = doc([
      {
        n: 1,
        editorial: false,
        scenes: [
          scene(1, [sd('Enter A.'), speech(PASSAGES[0] ?? '')]),
          scene(2, [sd('Enter B.'), speech(PASSAGES[1] ?? '')]),
        ],
      },
      { n: 2, editorial: false, scenes: [scene(1, [sd('Enter C.'), speech(PASSAGES[2] ?? '')])] },
    ]);
    const orig = doc([
      {
        n: 1,
        editorial: false,
        heading: 'Actus Primus.',
        scenes: [
          {
            ...scene(1, [
              sd('Enter A.'),
              speech(PASSAGES[0] ?? ''),
              sd('Exit.'),
              sd('Enter B.'),
              speech(PASSAGES[1] ?? ''),
              sd('Enter C.'),
              speech(PASSAGES[2] ?? ''),
            ]),
            heading: 'Scena Prima.',
          },
        ],
      },
    ]);

    expect(supplyEditorialDivisions(orig, modern).added).toStrictEqual(['1.2', '2.1']);
    expect(
      orig.divisions.map((act) => [
        act.n,
        act.editorial,
        act.heading,
        act.scenes.map((s) => [s.n, s.editorial, s.heading, s.blocks.length]),
      ]),
    ).toStrictEqual([
      [
        1,
        false,
        'Actus Primus.',
        [
          [1, false, 'Scena Prima.', 3], // the exit stays with the scene it ends
          [2, true, undefined, 2],
        ],
      ],
      [2, true, undefined, [[1, true, undefined, 2]]],
    ]);
  });

  it('leaves a fully divided version alone', () => {
    const orig = doc([{ n: 1, editorial: false, scenes: [scene(1, [speech(PASSAGES[0] ?? '')])] }]);
    const before = structuredClone(orig.divisions);
    expect(supplyEditorialDivisions(orig, structuredClone(orig)).added).toStrictEqual([]);
    expect(orig.divisions).toStrictEqual(before);
  });
});
