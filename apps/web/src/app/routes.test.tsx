import { describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react';

import { renderRoute } from '@/test/render';

describe('routes', () => {
  it('SEL-001: renders play selection at /', async () => {
    renderRoute('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Plays' })).toBeInTheDocument();
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
