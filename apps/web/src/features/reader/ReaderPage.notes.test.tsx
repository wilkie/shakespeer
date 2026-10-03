import { describe, expect, it } from '@jest/globals';
import { act, screen, waitFor, within } from '@testing-library/react';

import { renderRoute } from '@/test/render';

async function openReader() {
  const result = renderRoute('/plays/the-tempest/folger');
  await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 10000 });
  return result;
}

/** Selects part of the first text node whose text contains `word`. */
function select(word: string, from = 0, to = word.length): string {
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

describe('selection and notes', () => {
  it('SELX-002/007, ANN-020: Add annotation highlights the text and opens it for editing', async () => {
    const { user } = await openReader();
    select('Boatswain');

    const menu = await screen.findByRole('toolbar', { name: 'Selection' });
    await user.click(within(menu).getByRole('button', { name: 'Add annotation' }));

    const panel = await screen.findByRole('complementary', { name: 'Notes' }, { timeout: 5000 });
    const notes = within(panel).getByRole('textbox', { name: 'Notes' });
    await waitFor(() => {
      expect(notes).toHaveFocus();
    });
    expect(screen.queryByRole('toolbar', { name: 'Selection' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('.hl')?.textContent).toBe('Boatswain');
    });

    await user.paste('The *first* word spoken.');
    await user.click(within(panel).getByRole('button', { name: 'Done' }));

    expect(await within(panel).findByText('first')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(panel).getByRole('status')).toHaveTextContent('Saved');
    });
  });

  it('SELX-005/006, DEF-030: Add definition snaps to whole words and adds a term', async () => {
    const { user } = await openReader();
    // "arine" snaps out to the whole word.
    select('mariners', 1, 6);
    await user.click(await screen.findByRole('button', { name: 'Add definition' }));

    const panel = await screen.findByRole('complementary', { name: 'Notes' }, { timeout: 5000 });
    expect(within(panel).getByRole('heading', { name: '“mariners”' })).toBeInTheDocument();
    const meaning = within(panel).getByRole('textbox', { name: 'Meaning' });
    await waitFor(() => {
      expect(meaning).toHaveFocus();
    });
    await user.paste('An officer in charge of the deck crew');
    await user.click(within(panel).getByRole('button', { name: 'Done' }));

    expect(
      await within(panel).findByText('An officer in charge of the deck crew'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        [...document.querySelectorAll('.term')].some((el) => el.textContent === 'mariners'),
      ).toBe(true);
    });
  });

  it('PNL-023: Cancel deletes notes created during the edit session', async () => {
    const { user } = await openReader();
    select('topsail');

    await user.click(await screen.findByRole('button', { name: 'Add annotation' }));
    const panel = await screen.findByRole('complementary', { name: 'Notes' }, { timeout: 5000 });
    const highlighted = () => [...document.querySelectorAll('.hl')].map((el) => el.textContent);
    await waitFor(() => {
      expect(highlighted()).toContain('topsail');
    });
    await waitFor(() => {
      expect(within(panel).getByRole('textbox', { name: 'Notes' })).toHaveFocus();
    });
    await user.paste('Never mind');
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Notes' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(highlighted()).not.toContain('topsail');
    });
  });
});
