import { describe, expect, it } from '@jest/globals';

import { positionOf, rangePositions } from './selection';

function fixture() {
  document.body.innerHTML = `
    <div id="root">
      <div class="speaker">MIRANDA</div>
      <span class="line"><span class="ln">5</span><span class="node" data-node-id="n1">If by <i>your</i> art</span></span>
      <span class="line"><span class="node" data-node-id="n2">my dearest father</span></span>
    </div>`;
  return document.getElementById('root') as HTMLElement;
}

describe('selection mapping', () => {
  it('ANC-020: counts characters within a node, across inline markup', () => {
    const root = fixture();
    const art = root.querySelector('[data-node-id="n1"]')?.lastChild as Text; // " art"
    expect(positionOf(root, art, 2, 'start')).toStrictEqual({ nodeId: 'n1', offset: 12 });
  });

  it('SELX-004: moves boundaries in labels to the nearest text node', () => {
    const root = fixture();
    const speaker = root.querySelector('.speaker')?.firstChild as Text;
    const lineNumber = root.querySelector('.ln')?.firstChild as Text;
    expect(positionOf(root, speaker, 2, 'start')).toStrictEqual({ nodeId: 'n1', offset: 0 });
    expect(positionOf(root, lineNumber, 1, 'end')).toBeUndefined(); // nothing selected before it
  });

  it('ANC-020: converts a range spanning nodes', () => {
    const root = fixture();
    const range = document.createRange();
    range.setStart(root.querySelector('[data-node-id="n1"]')?.firstChild as Text, 3);
    range.setEnd(root.querySelector('[data-node-id="n2"]')?.firstChild as Text, 2);
    expect(rangePositions(root, range)).toStrictEqual({
      start: { nodeId: 'n1', offset: 3 },
      end: { nodeId: 'n2', offset: 2 },
    });
  });
});
