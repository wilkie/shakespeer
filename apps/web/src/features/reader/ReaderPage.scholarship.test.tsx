import { describe, expect, it } from '@jest/globals';
import { listNotes } from '@shakespeer/storage';
import { screen, waitFor, within } from '@testing-library/react';

import { getDatabase } from '@/lib/storage';
import { renderRoute } from '@/test/render';
import { select } from '@/test/selection';

/** Rendering a whole play takes a while under jsdom. */
const SLOW = { timeout: 30000 };
const TEST_TIMEOUT = 120000;

async function openReader() {
  const result = renderRoute('/plays/the-tempest/folger');
  await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, SLOW);
  return result;
}

/** "This island’s mine by Sycorax, my mother" (1.2.396), much quoted in the snapshot. */
const ISLAND = 'ftln-0467';

const toggle = async (user: Awaited<ReturnType<typeof openReader>>['user'], name: string) => {
  await user.click(screen.getByRole('button', { name: 'More actions' }));
  await user.click(await screen.findByRole('menuitemcheckbox', { name }));
  await user.keyboard('{Escape}');
};

// The tests share one database and build on each other, in order.
describe('scholarship', () => {
  it(
    'SCH-020/021/022: Scholarship on a selection lists the works quoting its lines',
    async () => {
      const { user } = await openReader();
      select('This island’s mine');
      const menu = await screen.findByRole('toolbar', { name: 'Selection' });
      await user.click(within(menu).getByRole('button', { name: 'Scholarship' }));

      const panel = await screen.findByRole('complementary', { name: 'Notes' }, SLOW);
      expect(within(panel).getByRole('heading', { name: 'Line 1.2.396' })).toBeInTheDocument();
      expect(within(panel).getAllByRole('button', { name: 'Cite in a note' })).toHaveLength(20);
      expect(within(panel).getByText(/From OpenAlex, retrieved/)).toBeInTheDocument();
      expect(
        within(panel).getByRole('button', { name: 'Search OpenAlex now' }),
      ).toBeInTheDocument();
    },
    TEST_TIMEOUT,
  );

  it(
    'SCH-032: Cite in a note adds the work to a new note on the line',
    async () => {
      const { user } = await openReader();
      select('This island’s mine');
      await user.click(
        within(await screen.findByRole('toolbar', { name: 'Selection' })).getByRole('button', {
          name: 'Scholarship',
        }),
      );
      const panel = await screen.findByRole('complementary', { name: 'Notes' }, SLOW);
      const firstTitle = within(panel).getAllByRole('link')[0]?.textContent ?? '';
      await user.click(
        within(panel).getAllByRole('button', { name: 'Cite in a note' })[0] as HTMLElement,
      );
      expect(
        await within(panel).findByText('Added to a new note on this line', undefined, SLOW),
      ).toBeInTheDocument();

      const { annotations } = await listNotes(await getDatabase(), 'the-tempest', 'folger');
      const note = annotations.find((a) => a.anchor.start.nodeId === ISLAND);
      expect(note?.anchor.quote.exact).toBe('This island’s mine by Sycorax, my mother,');
      expect(note?.citations.map((c) => c.title)).toEqual([firstTitle]);
    },
    TEST_TIMEOUT,
  );

  it(
    'SCH-020/023: margin marks open a line’s scholarship; switching the source off hides it',
    async () => {
      const { user } = await openReader();
      expect(document.querySelector('.sch-mark')).toBeNull(); // off by default
      await toggle(user, 'Show scholarship marks');
      const mark = await waitFor(() => {
        const found = document
          .querySelector(`[data-node-id="${ISLAND}"]`)
          ?.parentElement?.querySelector<HTMLElement>('.sch-mark');
        expect(found).toBeTruthy();
        return found as HTMLElement;
      }, SLOW);
      await user.click(mark);
      const panel = await screen.findByRole('complementary', { name: 'Notes' }, SLOW);
      expect(within(panel).getByRole('heading', { name: 'Line 1.2.396' })).toBeInTheDocument();

      await toggle(user, 'Scholarship');
      await waitFor(() => {
        expect(document.querySelector('.sch-mark')).toBeNull();
      }, SLOW);
      expect(
        within(panel).getByText(/Scholarship is switched off; search OpenAlex/),
      ).toBeInTheDocument();
    },
    TEST_TIMEOUT,
  );
});
