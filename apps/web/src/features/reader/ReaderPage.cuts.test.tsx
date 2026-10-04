import { describe, expect, it } from '@jest/globals';
import { screen, waitFor, within } from '@testing-library/react';

import { renderRoute } from '@/test/render';
import { select } from '@/test/selection';

/** Saving and re-rendering a whole play take a while under jsdom. */
const SLOW = { timeout: 10000 };
/** Each change re-renders the play, several times over in one test. */
const TEST_TIMEOUT = 60000;

async function openReader() {
  const result = renderRoute('/plays/the-tempest/folger');
  await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 10000 });
  return result;
}

const firstLine = () => document.querySelector<HTMLElement>('[data-node-id="ftln-0001"]');

// The tests share one database and build on each other, in order.
describe('cuts', () => {
  it(
    'CUT-020/021/030/031: a new cut opens in edit mode; Cut hides a selection, Undo brings it back',
    async () => {
      const { user } = await openReader();
      await user.click(screen.getByRole('button', { name: 'Cut: Full play. Change cut' }));
      await user.click(screen.getByRole('menuitem', { name: 'New cut…' }));
      const dialog = screen.getByRole('dialog', { name: 'New cut' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Study cut');
      await user.click(within(dialog).getByRole('button', { name: 'Create' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      }, SLOW);

      const edit = await screen.findByRole('button', { name: 'Edit cut' }, SLOW);
      await waitFor(() => {
        expect(edit).toHaveAttribute('aria-pressed', 'true');
      }, SLOW);
      expect(
        screen.getByRole('button', { name: 'Cut: Study cut. Change cut' }),
      ).toBeInTheDocument();

      // The first line, not the stage direction before it that names the Boatswain too.
      select('Boatswain!', 0, 9);
      const menu = await screen.findByRole('toolbar', { name: 'Selection' });
      await user.click(within(menu).getByRole('button', { name: 'Cut' }));
      await waitFor(() => {
        expect(firstLine()?.querySelector('.cut-hidden')?.textContent).toBe('Boatswain');
      }, SLOW);
      // The text stays in the page, so offsets in the line are unchanged (ANC-020).
      expect(firstLine()?.textContent).toBe('Boatswain!');
      expect(
        within(firstLine() as HTMLElement).getByRole('button', { name: 'Show cut text' }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Undo' }));
      await waitFor(() => {
        expect(firstLine()?.querySelector('.cut-hidden')).toBeNull();
      }, SLOW);
    },
    TEST_TIMEOUT,
  );

  it(
    'CUT-032/040: Cut speech collapses it to a marker that reveals it, struck through',
    async () => {
      const { user } = await openReader();
      await user.click(await screen.findByRole('button', { name: 'Edit cut' }, SLOW));
      const speech = firstLine()?.closest('.speech') as HTMLElement;
      await user.click(within(speech).getByRole('button', { name: 'Cut speech' }));

      const marker = await screen.findByRole('button', { name: '1 line cut' }, SLOW);
      expect(firstLine()).toBeNull();
      // Outside edit mode, activating the marker reveals the text in place.
      await user.click(screen.getByRole('button', { name: 'Edit cut' }));
      await user.click(marker);
      await waitFor(() => {
        expect(firstLine()?.closest('.cut-revealed')).not.toBeNull();
      }, SLOW);
      await user.click(screen.getByRole('button', { name: '1 line cut' }));
      await waitFor(() => {
        expect(firstLine()).toBeNull();
      }, SLOW);
    },
    TEST_TIMEOUT,
  );

  it(
    'CUT-033/042/043: replacements and insertions show; in edit mode they can be restored',
    async () => {
      const { user } = await openReader();
      await user.click(screen.getByRole('button', { name: 'Edit cut' }));

      select('Here, master');
      await user.click(await screen.findByRole('button', { name: 'Replace…' }));
      let dialog = screen.getByRole('dialog', { name: 'Replace wording' });
      await user.type(within(dialog).getByRole('textbox', { name: 'New wording' }), 'Aye, master');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      const replacement = await screen.findByRole(
        'button',
        { name: 'Aye, master (replaces “Here, master”)' },
        SLOW,
      );
      expect(replacement).toHaveAttribute('data-text', 'Aye, master');

      select('What cheer');
      await user.click(await screen.findByRole('button', { name: 'Insert after…' }));
      dialog = screen.getByRole('dialog', { name: 'Insert after this line' });
      await user.click(within(dialog).getByRole('radio', { name: 'Narration' }));
      await user.type(within(dialog).getByRole('textbox', { name: 'Text' }), 'The ship rolls.');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(document.querySelector('.cut-added.narration')?.textContent).toBe(
          '+ AddedThe ship rolls.',
        );
      }, SLOW);

      // Restoring the replacement brings back the original wording.
      await user.click(replacement);
      await user.click(await screen.findByRole('menuitem', { name: 'Restore' }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /replaces/ })).not.toBeInTheDocument();
      }, SLOW);
    },
    TEST_TIMEOUT,
  );

  it(
    'CUT-032/045: Cut scene hides it; the scene map marks it and navigation skips it',
    async () => {
      const { user } = await openReader();
      await user.click(screen.getByRole('button', { name: 'Edit cut' }));
      await user.click(screen.getAllByRole('button', { name: 'Cut scene' })[0] as HTMLElement);

      expect(await screen.findByRole('button', { name: 'Scene cut' }, SLOW)).toBeInTheDocument();
      const map = screen.getByRole('navigation', { name: 'Scenes' });
      expect(within(map).getByLabelText('Act 1, Scene 1 (cut)')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Restore scene' })).toHaveLength(1);
    },
    TEST_TIMEOUT,
  );

  it(
    'CUT-001/022: Full play is unchanged, and the cut last used comes back',
    async () => {
      const { user, unmount } = await openReader();
      expect(
        await screen.findByRole('button', { name: 'Cut: Study cut. Change cut' }, SLOW),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cut: Study cut. Change cut' }));
      await user.click(screen.getByRole('menuitem', { name: 'Full play' }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Scene cut' })).not.toBeInTheDocument();
      }, SLOW);
      expect(firstLine()?.textContent).toBe('Boatswain!');
      expect(screen.queryByRole('button', { name: 'Edit cut' })).not.toBeInTheDocument();
      unmount();

      await openReader();
      expect(
        await screen.findByRole('button', { name: 'Cut: Full play. Change cut' }, SLOW),
      ).toBeInTheDocument();
    },
    TEST_TIMEOUT,
  );

  it(
    'CUT-021: Manage cuts renames and deletes, with confirmation',
    async () => {
      const { user } = await openReader();
      await user.click(screen.getByRole('button', { name: 'Cut: Full play. Change cut' }));
      await user.click(screen.getByRole('menuitem', { name: 'Manage cuts…' }));
      const dialog = screen.getByRole('dialog', { name: 'Cuts' });
      expect(await within(dialog).findByText('Study cut', undefined, SLOW)).toBeInTheDocument();
      // The cut speech merged into the cut scene; the replacement was restored.
      expect(within(dialog).getByText(/2 changes/)).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Rename Study cut' }));
      const name = within(dialog).getByRole('textbox', { name: 'Cut name' });
      await user.clear(name);
      await user.type(name, 'Class cut');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(await within(dialog).findByText('Class cut', undefined, SLOW)).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Delete Class cut' }));
      const confirm = screen.getByRole('dialog', { name: 'Delete this cut?' });
      await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
      expect(
        await within(dialog).findByText(/This version has no cuts yet/, undefined, SLOW),
      ).toBeInTheDocument();
    },
    TEST_TIMEOUT,
  );
});
