import { describe, expect, it } from '@jest/globals';
import { screen, waitFor, within } from '@testing-library/react';

import { renderRoute } from '@/test/render';

describe('play selection', () => {
  it('SEL-002/003/004: lists plays by title with date and versions', async () => {
    renderRoute('/');

    const titles = await screen.findAllByRole('heading', { level: 2 });
    expect(titles.map((h) => h.textContent)).toStrictEqual([
      'Hamlet',
      'Othello',
      'Richard II',
      'The Tempest',
      'Troilus and Cressida',
    ]);

    const richard = screen.getByRole('link', { name: /Richard II/ });
    // No genre: the categories are disputed (SEL-002).
    expect(within(richard).queryByText(/History/)).not.toBeInTheDocument();
    expect(within(richard).getByText('First Quarto (1597)')).toBeInTheDocument();

    const tempest = screen.getByRole('link', { name: /The Tempest/ });
    expect(within(tempest).getByText('Written c. 1610–11')).toBeInTheDocument();
    expect(within(tempest).getByText('First Folio (1623)')).toBeInTheDocument();
  });

  it('SEL-005: choosing a play opens the reader', async () => {
    const { user, router } = renderRoute('/');

    await user.click(await screen.findByRole('link', { name: /Hamlet/ }));

    await waitFor(
      () => {
        expect(router.state.location.pathname).toBe('/plays/hamlet/folger');
      },
      { timeout: 30000 },
    );
  });
});
