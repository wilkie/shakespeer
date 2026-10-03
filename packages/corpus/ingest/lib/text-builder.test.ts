import { describe, expect, it } from '@jest/globals';

import { TextBuilder } from './text-builder.ts';

describe('TextBuilder', () => {
  it('collapses whitespace and trims', () => {
    const builder = new TextBuilder();
    builder.append('  To be,\n   or ');
    builder.append(' not to be ');

    expect(builder.build()).toStrictEqual({ text: 'To be, or not to be' });
  });

  it('CRP-023: records marks over the final text', () => {
    const builder = new TextBuilder();
    builder.append('  Sent to ');
    builder.open('italic');
    builder.append('Naples,');
    builder.close('italic');
    builder.append(' Let me not');

    expect(builder.build()).toStrictEqual({
      text: 'Sent to Naples, Let me not',
      marks: [{ start: 8, end: 15, type: 'italic' }],
    });
  });

  it('composes a combining mark with the preceding letter (NFC)', () => {
    const builder = new TextBuilder();
    builder.append('heaue');
    builder.append('̄');
    builder.append('s');

    expect(builder.build().text).toBe('heauēs');
  });

  it('merges adjacent marks of the same type and closes open marks', () => {
    const builder = new TextBuilder();
    builder.appendMarked('•', 'gap');
    builder.appendMarked('•', 'gap');
    builder.open('song');
    builder.append('Full fathom five');

    expect(builder.build().marks).toStrictEqual([
      { start: 0, end: 2, type: 'gap' },
      { start: 2, end: 18, type: 'song' },
    ]);
  });
});
