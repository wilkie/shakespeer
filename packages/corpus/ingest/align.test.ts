import { describe, expect, it } from '@jest/globals';

import type { Act, TextNode } from '../src/schema.ts';
import { alignVersions, wordKey } from './align.ts';

const line = (id: string, text: string): TextNode => ({ id, kind: 'line', text, form: 'verse' });
const sd = (id: string, text: string): TextNode => ({ id, kind: 'sd', text });

function version(...nodes: TextNode[]): { divisions: Act[] } {
  return {
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
  };
}

describe('wordKey', () => {
  it.each([
    ['haue', 'have'],
    ['heere', 'here'],
    ['vnto', 'unto'],
    ['stopt', 'stopped'],
    ["groan'd", 'groaned'],
    ['Musicke', 'music'],
    ['ſelfe', 'self'],
  ])('CRP-051: %s ~ %s', (original, modern) => {
    expect(wordKey(original)).toBe(wordKey(modern));
  });
});

describe('alignVersions', () => {
  it('CRP-050: pairs equivalent lines as same and differing ones as variant', () => {
    const entries = alignVersions(
      version(
        line('o1', 'Vnder my burthen groan’d, which rais’d in me'),
        line('o2', 'An vndergoing stomacke, to beare vp'),
        sd('o3', 'Exit Ariel.'),
      ),
      version(
        line('m1', 'Under my burden groaned, which raised in me'),
        line('m2', 'An undergoing stomach to bear up'),
        line('m3', 'Against what should ensue.'),
        sd('m4', 'Ariel exits.'),
      ),
    );

    expect(entries).toStrictEqual([
      { orig: ['o1'], modern: ['m1'], relation: 'same', status: 'auto' },
      { orig: ['o2'], modern: ['m2'], relation: 'same', status: 'auto' },
      { orig: [], modern: ['m3'], relation: 'modern-only', status: 'auto' },
      { orig: ['o3'], modern: ['m4'], relation: 'variant', status: 'auto' },
    ]);
  });

  it('CRP-050: groups a prose paragraph with the lines it spans', () => {
    const entries = alignVersions(
      version(line('o1', 'Heere Master: What cheere? Good: Speake to th’ Mariners')),
      version(line('m1', 'Here, master. What cheer?'), line('m2', 'Good, speak to th’ mariners.')),
    );

    expect(entries).toStrictEqual([
      { orig: ['o1'], modern: ['m1', 'm2'], relation: 'same', status: 'auto' },
    ]);
  });

  it('rejects an original scene with no modern counterpart', () => {
    const orig = version(line('o1', 'x'));
    orig.divisions[0]?.scenes.push({
      id: '1.2',
      kind: 'scene',
      n: 2,
      editorial: false,
      blocks: [],
    });

    expect(() => alignVersions(orig, version(line('m1', 'x')))).toThrow(/no modern counterpart/);
  });
});

describe('alignVersions across scene structures', () => {
  const scene = (id: string, n: number, nodes: TextNode[]) => ({
    id,
    kind: 'scene' as const,
    n,
    editorial: true,
    blocks: [{ type: 'speech' as const, speakers: [], label: '', nodes }],
  });

  it('CRP-051: aligns pieces of one modern scene together and marks scenes an original lacks as modern-only', () => {
    const modern = {
      divisions: [
        {
          n: null,
          editorial: false,
          scenes: [
            {
              ...scene('prologue', 1, [line('p1', 'In Troy there lies the scene')]),
              kind: 'prologue' as const,
              n: null,
            },
          ],
        },
        {
          n: 1,
          editorial: false,
          scenes: [
            scene('1.1', 1, [line('a1', 'first of the first'), line('a2', 'second of the first')]),
            scene('1.2', 2, [line('b1', 'only of the second')]),
          ],
        },
      ],
    };
    // An original without the prologue, with 1.1 split around 1.2 (as Q1 Hamlet does).
    const orig = {
      divisions: [
        {
          n: 1,
          editorial: true,
          scenes: [
            scene('1.1', 1, [line('o1', 'first of the first')]),
            scene('1.2', 2, [line('o2', 'only of the second')]),
            scene('1.1b', 1, [line('o3', 'second of the first')]),
          ],
        },
      ],
    };

    expect(alignVersions(orig, modern).map((e) => [e.orig, e.modern, e.relation])).toStrictEqual([
      [[], ['p1'], 'modern-only'],
      [['o1'], ['a1'], 'same'],
      [['o2'], ['b1'], 'same'],
      [['o3'], ['a2'], 'same'],
    ]);
  });
});
