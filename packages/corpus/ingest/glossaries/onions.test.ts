import { describe, expect, it } from '@jest/globals';

import { expandHeadword, parseOnions, readOnionsRoman } from './onions.ts';

describe('readOnionsRoman', () => {
  it.each([
    ['i', 1],
    ['n', 2],
    ['in', 3],
    ['m', 3],
    ['hi', 3],
    ['rv', 4],
    ['iv', 4],
    ['v', 5],
    ['vii', 7],
    ['xiii', 13],
  ])('CRP-073: reads the OCR numeral %s as %i', (token, n) => {
    expect(readOnionsRoman(token)).toBe(n);
  });

  it('rejects what is not a numeral', () => {
    expect(readOnionsRoman('the')).toBeUndefined();
  });
});

describe('expandHeadword', () => {
  it('CRP-073: restores the abbreviated headword in quotations', () => {
    expect(expandHeadword('A. thy hours!', 'abate')).toBe('Abate thy hours!');
    expect(expandHeadword('a-d me of half my train', 'abate')).toBe('abated me of half my train');
    expect(expandHeadword('I would b. here', 'abate')).toBe('I would b. here');
  });
});

describe('parseOnions', () => {
  const text = [
    'abase :  to  lower  (the  eyes)  2H6  i.  ii.  15,  R3  i.  ii.',
    '',
    '248  (Ff).',
    '',
    'abate  (1  the  usual  sense ;  the  corresponding  intr.',
    '',
    "sense  ' decrease '  is  rare)",
    '',
    '1  to  lessen,  shorten  MND.  in.  ii.  432  A.  thy  hours!',
    '',
    '2  to  blunt,  fig.  2H4  I.  i.  117  his  metal  once  in  him',
    '',
    'abated,  R3  v.  iv.  48  [v.  35]  Abate  the  edge  of  traitors.',
    '',
    'ABATE — ABHOR    3',
    '',
    'bodkin  (1  the  orig.  sense)',
    '',
    '1  dagger  Ham.  in.  i.  76  When  he  himself  might  his',
    '',
    'quietus  make  With  a  bare  bodkin.',
    '',
    'bosky  :  shrubby  Tp.  iv.  i.  81  My  bosky  acres.  %  Survives  in  dial.',
    '',
    'coil  (kept  a  coil)',
    '',
    '1  noise,  disturbance  Err.  in.  i.  48.',
    '',
    '2  fuss,  to-do  Ado  in.  iii.  99 ;  mortal  coil,  bustle  or  turmoil  of  this',
    '',
    'mortal  life  Ham.  m.  i.  67  this  mortal  coil ;  cf.  Tp.  i.  ii.  207.',
  ].join('\n');
  const entries = parseOnions(text);

  it('CRP-073: splits entries and senses, skipping notes and running heads', () => {
    expect(
      entries.map((e) => [e.headword, e.senses.map((s) => [s.label ?? null, s.gloss])]),
    ).toStrictEqual([
      ['abase', [[null, 'to lower']]],
      [
        'abate',
        [
          ['1', 'to lessen, shorten'],
          ['2', 'to blunt, fig'],
        ],
      ],
      ['bodkin', [['1', 'dagger']]],
      ['bosky', [[null, 'shrubby']]],
      [
        'coil',
        [
          ['1', 'noise, disturbance'],
          ['2', 'fuss, to-do'],
          ['2', 'mortal coil, bustle or turmoil of this mortal life'],
        ],
      ],
    ]);
  });

  it('CRP-071: reads citations with the quotation that follows each, dropping alternatives', () => {
    expect(entries[1]?.senses[1]?.citations).toStrictEqual([
      { play: '2H4', act: 1, scene: 1, line: 117, quote: 'his metal once in him abated' },
      { play: 'R3', act: 5, scene: 4, line: 48, quote: 'Abate the edge of traitors' },
    ]);
    expect(entries[2]?.senses[0]?.citations).toStrictEqual([
      {
        play: 'Ham',
        act: 3,
        scene: 1,
        line: 76,
        quote: 'When he himself might his quietus make With a bare bodkin',
      },
    ]);
  });

  it('drops ¶ notes and "cf." references', () => {
    expect(entries[3]?.senses[0]?.citations).toStrictEqual([
      { play: 'Tp', act: 4, scene: 1, line: 81, quote: 'My bosky acres' },
    ]);
    expect(entries[4]?.senses[2]?.citations).toStrictEqual([
      { play: 'Ham', act: 3, scene: 1, line: 67, quote: 'this mortal coil' },
    ]);
  });
});
