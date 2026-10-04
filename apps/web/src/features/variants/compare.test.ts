import { beforeAll, describe, expect, it } from '@jest/globals';
import { createVersionIndex, loadAlignment, loadVersion } from '@shakespeer/corpus';

import { compareRows, diffWords, type CompareSide } from './compare';

const side = async (versionId: string): Promise<CompareSide> => ({
  index: createVersionIndex(await loadVersion('hamlet', versionId)),
  alignment: versionId === 'folger' ? undefined : await loadAlignment('hamlet', versionId),
});

let folger: CompareSide;
let q1: CompareSide;
let q2: CompareSide;
let f1: CompareSide;

beforeAll(async () => {
  [folger, q1, q2, f1] = await Promise.all([
    side('folger'),
    side('q1-1603'),
    side('q2-1604'),
    side('f1-1623'),
  ]);
});

const text = (s: CompareSide, ids: readonly string[]) =>
  ids.map((id) => s.index.node(id)?.text ?? '').join(' / ');

describe('comparison rows', () => {
  it('VAR-021: every node of both versions appears once, in the current version’s order', () => {
    for (const [left, right] of [
      [folger, q2],
      [q2, f1],
      [q1, folger],
    ] as const) {
      const rows = compareRows(left, right);
      const leftIds = rows.flatMap((r) => r.left);
      const rightIds = rows.flatMap((r) => r.right);
      expect(leftIds).toStrictEqual(left.index.nodes.map((n) => n.id));
      expect([...rightIds].sort()).toStrictEqual(right.index.nodes.map((n) => n.id).sort());
    }
  });

  it('VAR-021: matches corresponding lines, composing alignments between original versions', () => {
    const rows = compareRows(q2, f1);
    const row = rows.find((r) => text(q2, r.left).startsWith('He smot the sleaded pollax'));
    expect(text(f1, row?.right ?? [])).toBe('He smot the sledded Pollax on the Ice.');
  });

  it('VAR-021: text the current version lacks faces an empty cell', () => {
    // "Denmark's a prison" (2.2) is in the Folio, not the Second Quarto.
    const rows = compareRows(q2, f1);
    const row = rows.find(
      (r) => text(f1, r.right).includes('Denmark') && text(f1, r.right).includes('Prison'),
    );
    expect(row?.left).toStrictEqual([]);
  });

  it('VAR-021: compared text from elsewhere in its own version is flagged as moved', () => {
    // Q1 puts "To be, or not to be" earlier (2.2) than the Folger edition (3.1).
    const rows = compareRows(folger, q1);
    const toBe = rows.find((r) => text(q1, r.right).startsWith('To be, or not to be'));
    expect(toBe).toBeDefined();
    expect(rows.some((r) => r.rightMoved)).toBe(true);
  });
});

describe('word differences', () => {
  it('VAR-023: reads "&" as "and"', () => {
    expect(diffWords('Stand and vnfolde', 'Stand & vnfold', false)).toStrictEqual({
      left: [],
      right: [],
    });
  });

  it('VAR-023: ignores spelling unless asked, and marks the words that differ', () => {
    const left = 'He smot the sleaded pollax on the ice.';
    const right = 'He smot the sledded Pollax on the Ice.';
    const loose = diffWords(left, right, false);
    expect(loose.left.map((r) => left.slice(r.start, r.end))).toStrictEqual(['sleaded']);
    expect(loose.right.map((r) => right.slice(r.start, r.end))).toStrictEqual(['sledded']);
    const exact = diffWords(left, right, true);
    expect(exact.left.map((r) => left.slice(r.start, r.end))).toStrictEqual([
      'sleaded',
      'pollax',
      'ice.',
    ]);
  });
});
