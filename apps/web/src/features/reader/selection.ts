/**
 * Converts DOM selection boundaries to corpus positions (ANC-020). Rendered node elements carry
 * `data-node-id` and contain exactly the node's text, so a boundary's offset is the length of
 * the text between the element's start and the boundary.
 */
import type { Position } from './anchors';

const NODE_SELECTOR = '[data-node-id]';

function nodeElementOf(node: Node): HTMLElement | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest<HTMLElement>(NODE_SELECTOR) ?? null;
}

function offsetWithin(element: HTMLElement, container: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(element, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

/**
 * The corpus position of a selection boundary. Boundaries outside text nodes (in a speaker
 * name, line number or heading, SELX-004) move to the nearest node in the selection: forward
 * for a start, backward for an end.
 */
export function positionOf(
  root: HTMLElement,
  container: Node,
  offset: number,
  edge: 'start' | 'end',
): Position | undefined {
  const element = nodeElementOf(container);
  if (element && root.contains(element)) {
    return {
      nodeId: element.dataset['nodeId'] ?? '',
      offset: offsetWithin(element, container, offset),
    };
  }
  const boundary = document.createRange();
  boundary.setStart(container, offset);
  const elements = [...root.querySelectorAll<HTMLElement>(NODE_SELECTOR)];
  if (edge === 'start') {
    const next = elements.find((el) => boundary.comparePoint(el, 0) >= 0);
    return next ? { nodeId: next.dataset['nodeId'] ?? '', offset: 0 } : undefined;
  }
  const previous = elements.findLast((el) => boundary.comparePoint(el, el.childNodes.length) <= 0);
  return previous
    ? { nodeId: previous.dataset['nodeId'] ?? '', offset: previous.textContent.length }
    : undefined;
}

/** The selection's range if it is non-empty and lies within the play text (SELX-002/003). */
export function textSelection(root: HTMLElement): Range | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return undefined;
  }
  const range = selection.getRangeAt(0);
  return root.contains(range.startContainer) && root.contains(range.endContainer)
    ? range
    : undefined;
}

/** Corpus start and end of a DOM range inside the play text. */
export function rangePositions(
  root: HTMLElement,
  range: Range,
): { start: Position; end: Position } | undefined {
  const start = positionOf(root, range.startContainer, range.startOffset, 'start');
  const end = positionOf(root, range.endContainer, range.endOffset, 'end');
  return start && end ? { start, end } : undefined;
}
