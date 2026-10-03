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

  it('rejects versions whose scene structures differ', () => {
    const other = version(line('m1', 'x'));
    other.divisions[0]?.scenes.push({
      id: '1.2',
      kind: 'scene',
      n: 2,
      editorial: false,
      blocks: [],
    });

    expect(() => alignVersions(version(line('o1', 'x')), other)).toThrow(/scene map/);
  });
});
