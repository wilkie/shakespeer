import { describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react';

import { renderRoute } from '@/test/render';

describe('routes', () => {
  it('renders the home page at /', async () => {
    renderRoute('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shakespeer' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
  });

  it('renders the not-found page for unknown paths', async () => {
    const { user, router } = renderRoute('/no-such-play');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Return home' }));

    expect(router.state.location.pathname).toBe('/');
  });
});
