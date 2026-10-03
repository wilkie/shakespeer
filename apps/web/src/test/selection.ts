import { act } from '@testing-library/react';

/** Selects part of the first text node whose text contains `word`. */
export function select(word: string, from = 0, to = word.length): string {
  const element = [...document.querySelectorAll<HTMLElement>('[data-node-id]')].find((el) =>
    el.textContent.includes(word),
  );
  if (!element) {
    throw new Error(`No text contains ${word}`);
  }
  const start = element.textContent.indexOf(word) + from;
  const end = start + (to - from);
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let offset = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (start >= offset && start < offset + length) {
      range.setStart(node, start - offset);
    }
    if (end > offset && end <= offset + length) {
      range.setEnd(node, end - offset);
    }
    offset += length;
  }
  act(() => {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  return element.dataset['nodeId'] ?? '';
}
