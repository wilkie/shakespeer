import { describe, expect, it } from '@jest/globals';

import { segmentText } from './segments';

describe('segmentText', () => {
  it('ANC-020: splits text at mark and decoration boundaries, keeping offsets', () => {
    expect(
      segmentText(
        'Sent to Naples, Let me not',
        [{ start: 8, end: 15, type: 'italic' }],
        [{ start: 0, end: 4, id: 't1' }],
      ),
    ).toStrictEqual([
      { text: 'Sent', start: 0, end: 4, marks: [], ids: ['t1'] },
      { text: ' to ', start: 4, end: 8, marks: [], ids: [] },
      { text: 'Naples,', start: 8, end: 15, marks: ['italic'], ids: [] },
      { text: ' Let me not', start: 15, end: 26, marks: [], ids: [] },
    ]);
  });

  it('DEF-033: lists every decoration covering overlapping ranges', () => {
    const segments = segmentText(
      'quietus make',
      [],
      [
        { start: 0, end: 12, id: 'phrase' },
        { start: 0, end: 7, id: 'word' },
      ],
    );
    expect(segments.map((s) => [s.text, s.ids])).toStrictEqual([
      ['quietus', ['phrase', 'word']],
      [' make', ['phrase']],
    ]);
  });

  it('returns the whole text when nothing applies', () => {
    expect(segmentText('Boatswain!')).toStrictEqual([
      { text: 'Boatswain!', start: 0, end: 10, marks: [], ids: [] },
    ]);
  });
});
