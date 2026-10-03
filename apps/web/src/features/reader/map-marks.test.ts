import { beforeAll, describe, expect, it } from '@jest/globals';
import { createVersionIndex, loadVersion, type VersionIndex } from '@shakespeer/corpus';
import type { AnnotationRecord, HighlightColor } from '@shakespeer/storage';

import { makeAnchor } from './anchors';
import { markGroups } from './map-marks';

describe('map marks', () => {
  let index: VersionIndex;
  const annotation = (id: string, nodeIndex: number, color: HighlightColor): AnnotationRecord => {
    const node = index.nodes[nodeIndex];
    const anchor =
      node && makeAnchor(index, { nodeId: node.id, offset: 0 }, { nodeId: node.id, offset: 3 });
    if (!anchor) {
      throw new Error('no anchor');
    }
    return {
      id,
      playId: 'the-tempest',
      versionId: 'folger',
      anchor,
      origin: { kind: 'own' },
      createdAt: '',
      updatedAt: '',
      color,
      notes: '',
      links: [],
      citations: [],
    };
  };

  beforeAll(async () => {
    index = createVersionIndex(await loadVersion('the-tempest', 'folger'));
  });

  it('MAP-041: places marks proportionally by their first text node', () => {
    const half = Math.floor(index.nodes.length / 2);
    const [group] = markGroups(index, [annotation('a', half, 'blue')], 1000);
    expect(group?.top).toBeCloseTo((half / index.nodes.length) * 1000);
  });

  it('MAP-042: merges marks closer than the mark height', () => {
    const groups = markGroups(
      index,
      [annotation('a', 10, 'pink'), annotation('b', 11, 'yellow'), annotation('c', 900, 'green')],
      500,
    );
    expect(groups.map((g) => g.annotations.map((a) => a.id))).toStrictEqual([['a', 'b'], ['c']]);
  });
});
