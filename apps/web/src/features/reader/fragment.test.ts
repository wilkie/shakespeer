import { beforeAll, describe, expect, it } from '@jest/globals';
import { createVersionIndex, loadVersion, type VersionIndex } from '@shakespeer/corpus';

import { fragmentFor, resolveFragment } from './fragment';

describe('reading position fragments', () => {
  let folger: VersionIndex;
  let folio: VersionIndex;

  beforeAll(async () => {
    folger = createVersionIndex(await loadVersion('the-tempest', 'folger'));
    folio = createVersionIndex(await loadVersion('the-tempest', 'f1-1623'));
  });

  it('RDR-031: uses the line number of a line', () => {
    const line = folger.lineByNumber('1.2.45');
    expect(fragmentFor(folger, line?.id ?? '')).toBe('1.2.45');
  });

  it('RDR-031: addresses unnumbered nodes after the nearest numbered line', () => {
    const line = folger.lineByNumber('1.1.4');
    const next = folger.nodes[(folger.indexOf(line?.id ?? '') ?? 0) + 1];
    expect(next?.kind).toBe('sd');
    expect(fragmentFor(folger, next?.id ?? '')).toBe('1.1.4+1');
  });

  it('RDR-031: addresses nodes before a scene’s first number by scene', () => {
    expect(fragmentFor(folger, folger.nodes[0]?.id ?? '')).toBe('1.1');
  });

  it('RDR-032: resolves line, offset and scene fragments', () => {
    const line = folger.lineByNumber('3.1.20');
    expect(resolveFragment(folger, '#3.1.20')).toStrictEqual({ kind: 'node', nodeId: line?.id });
    expect(resolveFragment(folger, '1.1.4+1')).toStrictEqual({
      kind: 'node',
      nodeId: fragmentNode(folger, '1.1.4', 1),
    });
    expect(resolveFragment(folger, '#2.1')).toStrictEqual({ kind: 'scene', sceneIndex: 2 });
    expect(resolveFragment(folger, '#9.9.9')).toBeUndefined();
  });

  it('CRP-041: round-trips every node of an original version', () => {
    const misses = folio.nodes.filter((node, position) => {
      const target = resolveFragment(folio, fragmentFor(folio, node.id) ?? '');
      // A scene's first node is addressed by the scene, which scrolls to its heading.
      return target?.kind === 'scene'
        ? folio.scenes[target.sceneIndex]?.start !== position
        : target?.nodeId !== node.id;
    });
    expect(misses).toStrictEqual([]);
  });
});

function fragmentNode(index: VersionIndex, n: string, offset: number): string | undefined {
  const line = index.lineByNumber(n);
  return index.nodes[(index.indexOf(line?.id ?? '') ?? 0) + offset]?.id;
}
