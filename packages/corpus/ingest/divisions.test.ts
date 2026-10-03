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

describe('supplyEditorialDivisions for a reordered version', () => {
  // Each scene's words are its own, so its phrases are distinctive.
  const A = `alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu`;
  const B = `one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty`;
  const C = `mercury venus earth mars jupiter saturn uranus neptune pluto ceres eris makemake haumea sedna quaoar orcus ixion varuna gonggong salacia chaos deucalion huya`;
  const long = (words: string) => `${words} ${words} ${words}`;

  const modern = () =>
    doc([
      {
        n: 1,
        editorial: false,
        scenes: [
          scene(1, [sd('Enter A.'), speech(long(A))]),
          scene(2, [sd('Enter B.'), speech(long(B))]),
          scene(3, [sd('Enter C.'), speech(long(C))]),
        ],
      },
    ]);
  const undivided = () =>
    doc([
      {
        n: 1,
        editorial: true,
        scenes: [
          scene(
            1,
            [
              sd('Enter A.'),
              speech(long(A)),
              sd('Enter C.'),
              speech(long(C)),
              sd('Enter B.'),
              speech(long(B)),
            ],
            true,
          ),
        ],
      },
    ]);

  it('CRP-031, CRP-051: labels each stretch with the modern scene it matches, in its own order', () => {
    const orig = undivided();
    expect(supplyEditorialDivisions(orig, modern(), { order: 'free' }).added).toStrictEqual([
      '1.1',
      '1.3',
      '1.2',
    ]);
    expect(
      orig.divisions[0]?.scenes.map((s) => [s.id, s.editorial, s.blocks.length]),
    ).toStrictEqual([
      ['1.1', true, 2],
      ['1.3', true, 2],
      ['1.2', true, 2],
    ]);
  });

  it('CRP-004: curated scene starts replace the automatic ones', () => {
    const orig = undivided();
    const first = (i: number) => {
      const block = orig.divisions[0]?.scenes[0]?.blocks[i];
      return block?.type === 'sd' ? block.node.id : '';
    };
    const scenes = [
      { from: first(0), scene: '1.1' },
      { from: first(4), scene: '1.2' },
    ];
    supplyEditorialDivisions(orig, modern(), { order: 'free', scenes });
    expect(orig.divisions[0]?.scenes.map((s) => [s.id, s.blocks.length])).toStrictEqual([
      ['1.1', 4],
      ['1.2', 2],
    ]);
  });
});
