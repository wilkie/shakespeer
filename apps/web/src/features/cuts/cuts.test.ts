import { beforeAll, describe, expect, it } from '@jest/globals';
import { createVersionIndex, loadVersion, type VersionIndex } from '@shakespeer/corpus';
import type { CutOperation } from '@shakespeer/storage';

import { sceneNavigation } from '@/features/reader/navigation';

import { displayCut, insertedNodeId } from './display';
import {
  canReplace,
  hideSpan,
  insertAfter,
  nodeSpan,
  replaceSpan,
  restoreNodes,
} from './operations';

let index: VersionIndex;
const line = (n: string) => index.lineByNumber(n)?.id ?? '';
const at = (n: string, offset: number) => ({ nodeId: line(n), offset });
const end = (n: string) => ({ nodeId: line(n), offset: index.lineByNumber(n)?.text.length ?? 0 });
const sceneSpan = (sceneId: string) => {
  const scene = index.scenes.find((s) => s.scene.id === sceneId);
  return scene ? (nodeSpan(index, scene.start, scene.end - 1) ?? undefined) : undefined;
};

beforeAll(async () => {
  index = createVersionIndex(await loadVersion('the-tempest', 'folger'));
});

describe('cut operations', () => {
  it('CUT-034: overlapping and touching cuts merge, absorbing replacements', () => {
    let ops: CutOperation[] = hideSpan(index, [], at('1.2.45', 0), at('1.2.45', 5));
    ops = replaceSpan(index, ops, at('1.2.46', 0), at('1.2.46', 3), 'This');
    expect(ops.map((op) => op.type)).toStrictEqual(['hide', 'replace']);
    ops = hideSpan(index, ops, at('1.2.45', 3), end('1.2.46'));
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      type: 'hide',
      anchor: { start: at('1.2.45', 0), end: end('1.2.46') },
    });
  });

  it('CUT-034: replacing text that is cut is not offered', () => {
    const ops = hideSpan(index, [], at('1.2.45', 0), at('1.2.45', 5));
    expect(canReplace(index, ops, at('1.2.45', 3), at('1.2.45', 8))).toBe(false);
    expect(canReplace(index, ops, at('1.2.46', 0), at('1.2.46', 3))).toBe(true);
  });

  it('CUT-032: restoring a scene keeps the parts of a cut outside it', () => {
    const first = sceneSpan('1.1');
    const second = sceneSpan('1.2');
    if (!first || !second) {
      throw new Error('no scenes');
    }
    const ops = hideSpan(index, [], first.start, at('1.2.45', 5));
    const scene = index.scenes[1];
    const restored = restoreNodes(index, ops, scene?.start ?? 0, (scene?.end ?? 1) - 1);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ anchor: { start: first.start, end: first.end } });
  });
});

describe('displayed document', () => {
  it('CUT-040/045: a cut scene keeps its place but is skipped by scene navigation', () => {
    const span = sceneSpan('1.2');
    if (!span) {
      throw new Error('no scene');
    }
    const display = displayCut(index, {
      id: 'c1',
      operations: hideSpan(index, [], span.start, span.end),
    });
    expect(display.cutScenes).toStrictEqual(new Set(['1.2']));
    const shown = display.index;
    expect(shown.scenes.map((s) => s.scene.id)).toStrictEqual(index.scenes.map((s) => s.scene.id));
    expect(shown.scenes[1]?.end).toBe(shown.scenes[1]?.start);
    expect(shown.nodes.length).toBeLessThan(index.nodes.length);
    // From the start of 1.1, next skips the cut 1.2.
    expect(sceneNavigation(shown, 0).next).toBe(2);
    // A hidden node finds the next displayed one.
    expect(shown.indexOf(line('1.2.45'))).toBe(shown.scenes[2]?.start);
  });

  it('CUT-040/042: hides part of a line; a replacement shows its wording where it starts', () => {
    const ops = replaceSpan(
      index,
      hideSpan(index, [], at('1.2.45', 0), at('1.2.45', 5)),
      at('1.2.46', 0),
      end('1.2.47'),
      'Now listen.',
    );
    const display = displayCut(index, { id: 'c1', operations: ops });
    expect(display.hidden.get(line('1.2.45'))).toMatchObject([{ start: 0, end: 5, type: 'hide' }]);
    expect(display.hiddenNodes.has(line('1.2.45'))).toBe(false);
    // The replaced lines: the first shows the new wording, the rest are hidden.
    expect(display.replacements.get(line('1.2.46'))).toMatchObject([
      { offset: 0, op: { text: 'Now listen.' } },
    ]);
    expect(display.hiddenNodes.has(line('1.2.46'))).toBe(false);
    expect(display.hiddenNodes.has(line('1.2.47'))).toBe(true);
  });

  it('CUT-043/051: inserts nodes after a line with namespaced IDs', () => {
    const ops = insertAfter([], line('1.2.45'), 'narration', 'Prospero sits.');
    const display = displayCut(index, { id: 'c1', operations: ops });
    const inserted = display.inserts.get(line('1.2.45'));
    expect(inserted).toMatchObject([
      { id: insertedNodeId('c1', ops[0]?.id ?? ''), text: 'Prospero sits.', narration: true },
    ]);
    const position = display.index.indexOf(line('1.2.45')) ?? 0;
    expect(display.index.nodes[position + 1]?.id).toBe(inserted?.[0]?.id);
  });

  it('CUT-050: operations whose text cannot be found do nothing', () => {
    const ops = hideSpan(index, [], at('1.2.45', 0), at('1.2.45', 5));
    const [op] = ops;
    const lost: CutOperation[] =
      op?.type === 'hide'
        ? [
            {
              ...op,
              anchor: { ...op.anchor, quote: { exact: 'Nowhere at all', prefix: '', suffix: '' } },
            },
          ]
        : [];
    const display = displayCut(index, { id: 'c1', operations: lost });
    expect(display.unattached).toHaveLength(1);
    expect(display.hidden.size).toBe(0);
  });
});
