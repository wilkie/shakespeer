import { describe, expect, it } from '@jest/globals';
import { screen, waitFor, within } from '@testing-library/react';

import { renderRoute } from '@/test/render';
import { select } from '@/test/selection';

/** Saving and re-rendering a whole play take a while under jsdom. */
const SLOW = { timeout: 5000 };

async function openReader() {
  const result = renderRoute('/plays/the-tempest/folger');
  await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 10000 });
  return result;
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
    }, SLOW);
    expect(screen.queryByRole('toolbar', { name: 'Selection' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('.hl')?.textContent).toBe('Boatswain');
    }, SLOW);

    await user.paste('The *first* word spoken.');
    await user.click(within(panel).getByRole('button', { name: 'Done' }));

    expect(await within(panel).findByText('first')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(panel).getByRole('status')).toHaveTextContent('Saved');
    }, SLOW);
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
    }, SLOW);
    await user.paste('An officer in charge of the deck crew');
    await user.click(within(panel).getByRole('button', { name: 'Done' }));

    expect(
      await within(panel).findByText('An officer in charge of the deck crew'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        [...document.querySelectorAll('.term')].some((el) => el.textContent === 'mariners'),
      ).toBe(true);
    }, SLOW);
  });

  it('PNL-023: Cancel deletes notes created during the edit session', async () => {
    const { user } = await openReader();
    select('topsail');

    await user.click(await screen.findByRole('button', { name: 'Add annotation' }));
    const panel = await screen.findByRole('complementary', { name: 'Notes' }, { timeout: 5000 });
    const highlighted = () => [...document.querySelectorAll('.hl')].map((el) => el.textContent);
    await waitFor(() => {
      expect(highlighted()).toContain('topsail');
    }, SLOW);
    await waitFor(() => {
      expect(within(panel).getByRole('textbox', { name: 'Notes' })).toHaveFocus();
    }, SLOW);
    await user.paste('Never mind');
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Notes' })).not.toBeInTheDocument();
    }, SLOW);
    await waitFor(() => {
      expect(highlighted()).not.toContain('topsail');
    }, SLOW);
  });
});
