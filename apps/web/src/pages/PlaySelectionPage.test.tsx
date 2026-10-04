import { describe, expect, it } from '@jest/globals';
import { screen, waitFor, within } from '@testing-library/react';

import { renderRoute } from '@/test/render';

describe('play selection', () => {
  it('SEL-002/003/004: lists plays by title with genre and versions', async () => {
    renderRoute('/');

    const titles = await screen.findAllByRole('heading', { level: 2 });
    expect(titles.map((h) => h.textContent)).toStrictEqual([
      'Hamlet',
      'The Tempest',
      'Troilus and Cressida',
    ]);

    const tempest = screen.getByRole('link', { name: /The Tempest/ });
    expect(within(tempest).getByText(/Romance/)).toBeInTheDocument();
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
