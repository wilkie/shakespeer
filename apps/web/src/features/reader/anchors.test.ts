import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  createVersionIndex,
  loadVersion,
  type TextAnchor,
  type VersionIndex,
} from '@shakespeer/corpus';

import {
  anchorsEqual,
  covers,
  decorationsFor,
  makeAnchor,
  resolveAnchor,
  snapToWords,
  textBetween,
} from './anchors';

describe('anchors', () => {
  let index: VersionIndex;
  let line1: string;
  let line2: string;

  beforeAll(async () => {
    index = createVersionIndex(await loadVersion('the-tempest', 'folger'));
    line1 = index.lineByNumber('1.2.45')?.id ?? ''; // Concluding “Stay. Not yet.”
    line2 = index.lineByNumber('1.2.46')?.id ?? ''; // The hour’s now come.
  });

  it('SELX-005: snaps outward to whole words and trims punctuation', () => {
    // "Concluding “Stay. Not yet.”": select "luding “St"
    const snapped = snapToWords(index, { nodeId: line1, offset: 4 }, { nodeId: line1, offset: 14 });
    expect(snapped && textBetween(index, snapped.start, snapped.end)).toBe('Concluding “Stay');
  });

  it('SELX-005: trims across node boundaries', () => {
    const text = index.node(line1)?.text ?? '';
    const snapped = snapToWords(
      index,
      { nodeId: line1, offset: text.length - 1 },
      { nodeId: line2, offset: 3 },
    );
    expect(snapped && textBetween(index, snapped.start, snapped.end)).toBe('The');
  });

  it('ANC-002/004: makes multi-node anchors with context', () => {
    const anchor = makeAnchor(index, { nodeId: line1, offset: 11 }, { nodeId: line2, offset: 3 });
    expect(anchor).toMatchObject({
      quote: { exact: '“Stay. Not yet.”\nThe', prefix: 'Concluding ', suffix: ' hour’s now come.' },
      revision: index.doc.revision,
    });
    expect(
      decorationsFor(index, anchor as TextAnchor, 'a1').map(([id, d]) => [id, d.start, d.end]),
    ).toStrictEqual([
      [line1, 11, (index.node(line1)?.text ?? '').length],
      [line2, 0, 3],
    ]);
  });

  it('ANC-010/011: compares anchors and tests coverage', () => {
    const a = makeAnchor(
      index,
      { nodeId: line1, offset: 0 },
      { nodeId: line1, offset: 10 },
    ) as TextAnchor;
    const b = { ...a, quote: { ...a.quote, prefix: 'different' } };
    expect(anchorsEqual(a, b)).toBe(true);
    expect(covers(index, a, { nodeId: line1, offset: 9 })).toBe(true);
    expect(covers(index, a, { nodeId: line1, offset: 10 })).toBe(false);
    expect(covers(index, a, { nodeId: line2, offset: 0 })).toBe(false);
  });

  it('ANC-030: valid anchors resolve unchanged', () => {
    const anchor = makeAnchor(
      index,
      { nodeId: line2, offset: 4 },
      { nodeId: line2, offset: 10 },
    ) as TextAnchor;
    expect(resolveAnchor(index, anchor)).toStrictEqual({ status: 'valid', anchor });
  });

  it('ANC-031: repairs an anchor whose text moved, using its context', () => {
    const anchor = makeAnchor(
      index,
      { nodeId: line2, offset: 4 },
      { nodeId: line2, offset: 10 },
    ) as TextAnchor;
    const moved = {
      ...anchor,
      start: { nodeId: line1, offset: 0 },
      end: { nodeId: line1, offset: 6 },
      revision: 'old',
    };

    expect(resolveAnchor(index, moved)).toStrictEqual({
      status: 'repaired',
      anchor: { ...anchor, revision: index.doc.revision },
    });
  });

  it('ANC-032: leaves an anchor unattached when its text is gone or ambiguous', () => {
    const gone: TextAnchor = {
      start: { nodeId: line1, offset: 0 },
      end: { nodeId: line1, offset: 3 },
      quote: { exact: 'no such words anywhere', prefix: '', suffix: '' },
      revision: 'old',
    };
    expect(resolveAnchor(index, gone)).toStrictEqual({ status: 'unattached' });
    expect(
      resolveAnchor(index, { ...gone, quote: { exact: 'the', prefix: '', suffix: '' } }),
    ).toStrictEqual({
      status: 'unattached',
    });
  });
});
