import { describe, expect, it } from '@jest/globals';

import { alphabeticalRun, parseCitations, parseEntries, readRoman } from './schmidt.ts';

describe('readRoman', () => {
  it.each([
    ['I', 1],
    ['Il', 2],
    ['IU', 3],
    ['Ill', 3],
    ['HI', 3],
    ['TII', 3],
    ['lV', 4],
    ['Y', 5],
  ])('CRP-073: reads the OCR numeral %s as act %i', (token, act) => {
    expect(readRoman(token)).toBe(act);
  });

  it('rejects implausible numerals', () => {
    expect(readRoman('XL')).toBeUndefined();
  });
});

describe('parseCitations', () => {
  it('CRP-071: reads full, continued and single-scene-act references with their quotations', () => {
    expect(
      parseCitations(
        'goodly person, Tp. 1, 2, 415. 417. Ill, 1, 51. a bare b. Hml. III, 1, 76. V, 130.175 etc.',
      ),
    ).toStrictEqual([
      { play: 'Tp', act: 1, scene: 2, line: 415, quote: 'goodly person' },
      { play: 'Tp', act: 1, scene: 2, line: 417, quote: '' },
      { play: 'Tp', act: 3, scene: 1, line: 51, quote: '' },
      { play: 'Hml', act: 3, scene: 1, line: 76, quote: 'a bare b' },
      { play: 'Hml', act: 5, scene: null, line: 130, quote: '' },
      { play: 'Hml', act: 5, scene: null, line: 175, quote: '' },
    ]);
  });

  it('reads prologue references', () => {
    expect(parseCitations('Troil. Prol. 5.')).toStrictEqual([
      { play: 'Troil', act: null, scene: null, part: 'prologue', line: 5, quote: '' },
    ]);
  });
});

describe('alphabeticalRun', () => {
  it('keeps the longest alphabetical run, dropping out-of-order lookalikes', () => {
    expect([...alphabeticalRun(['bob', 'wye', 'bocchus', 'bode', 'body'])].sort()).toStrictEqual([
      0, 2, 3, 4,
    ]);
  });
});

describe('parseEntries', () => {
  const text = [
    'Bodkin, a sharp instrument to make holes ',
    'by piercing: what is this? a cittern-head; the head of ',
    'a b. LLL V, 2, 615. when he himself might his quietus ',
    'make with a bare b. Hml. III, 1, 76. ',
    '',
    'Body, subst., 1) the frame of an animal: though ',
    'nothing but my —’s bane would cure thee, Ven. 372. Tp. IV, 191. ',
    '',
    '2) corpse: Hml. IV, 2, 28. ',
    '',
    'Bodykins, see Bodkin. ',
    '',
    'Boil, vb., trans. a) to dress or cook in boiling wa- ',
    '',
    'ter; absol.: Tp. II, 1, 76. ',
  ].join('\n');
  const entries = parseEntries(text);

  it('CRP-073: splits entries and senses and parses parts of speech', () => {
    expect(
      entries.map((e) => [e.headword, e.partOfSpeech, e.senses.map((s) => [s.label, s.gloss])]),
    ).toStrictEqual([
      ['Bodkin', undefined, [[undefined, 'a sharp instrument to make holes by piercing']]],
      [
        'Body',
        'noun',
        [
          ['1', 'the frame of an animal'],
          ['2', 'corpse'],
        ],
      ],
      ['Bodykins', undefined, [[undefined, '']]],
      ['Boil', 'verb', [[undefined, 'to dress or cook in boiling water']]],
    ]);
  });

  it('attaches citations to their sense', () => {
    expect(entries[1]?.senses[1]?.citations).toStrictEqual([
      { play: 'Hml', act: 4, scene: 2, line: 28, quote: '' },
    ]);
  });
});
