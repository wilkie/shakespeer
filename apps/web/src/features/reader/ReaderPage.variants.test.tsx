import { describe, expect, it } from '@jest/globals';
import { screen, waitFor, within } from '@testing-library/react';

import { renderRoute } from '@/test/render';

/** Rendering a whole play, or two of them side by side, takes a while under jsdom. */
const SLOW = { timeout: 30000 };
const TEST_TIMEOUT = 120000;

async function openReader(path = '/plays/the-tempest/folger') {
  const result = renderRoute(path);
  await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, SLOW);
  return result;
}

describe('variants', () => {
  it(
    'VAR-001/004: a variant mark opens the variant with every version’s reading',
    async () => {
      const { user, router } = await openReader();
      // "she" (1.2.335) is an editorial emendation; the Folio reads differently.
      const line = document.querySelector('[data-node-id="ftln-0406"]');
      const mark = line?.parentElement?.querySelector<HTMLElement>('.var-mark');
      expect(mark).toHaveAttribute('aria-label', 'Variant: Editorial emendation: “she” (1.2.335)');
      await user.click(mark as HTMLElement);

      const panel = await screen.findByRole('complementary', { name: 'Notes' }, SLOW);
      expect(within(panel).getByText('Editorial emendation: “she” (1.2.335)')).toBeInTheDocument();
      expect(within(panel).getByText('Folger edition (shown)')).toBeInTheDocument();
      expect(within(panel).getByText(/Saue for the Son/)).toBeInTheDocument();

      await user.click(within(panel).getByRole('button', { name: 'Open in F1' }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/plays/the-tempest/f1-1623');
      }, SLOW);
    },
    TEST_TIMEOUT,
  );

  it(
    'VAR-003: marks can be turned off',
    async () => {
      const { user } = await openReader();
      expect(document.querySelectorAll('.var-mark').length).toBeGreaterThan(0);
      await user.click(screen.getByRole('button', { name: 'More actions' }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: 'Show variant marks' }));
      await waitFor(() => {
        expect(document.querySelectorAll('.var-mark')).toHaveLength(0);
      }, SLOW);
      await user.click(screen.getByRole('menuitemcheckbox', { name: 'Show variant marks' }));
    },
    TEST_TIMEOUT,
  );

  it(
    'VAR-020/021/025: compares with another version row by row, without the cut control',
    async () => {
      const { user } = await openReader();
      await user.click(screen.getByRole('button', { name: 'More actions' }));
      await user.click(screen.getByRole('menuitem', { name: 'First Folio (1623)' }));

      expect(
        await screen.findByText('Compared with First Folio (1623)', undefined, SLOW),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(document.querySelectorAll('.cmp-row').length).toBeGreaterThan(100);
      }, SLOW);
      expect(screen.queryByRole('button', { name: /Change cut/ })).not.toBeInTheDocument();
      // The first spoken line, "Boatswain!", faces the Folio's "BOte-swaine."
      const row = document.querySelector('[data-node-id="ftln-0001"]')?.closest('.cmp-row');
      expect(row?.querySelector('.cmp-right')?.textContent).toContain('BOte-swaine.');

      await user.click(screen.getByRole('button', { name: 'End comparison' }));
      await waitFor(() => {
        expect(document.querySelectorAll('.cmp-row')).toHaveLength(0);
      }, SLOW);
      expect(screen.getByRole('button', { name: /Change cut/ })).toBeInTheDocument();
    },
    TEST_TIMEOUT,
  );
});
