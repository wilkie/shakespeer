import { describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react';

import { renderRoute } from '@/test/render';

describe('routes', () => {
  it('SEL-001: renders play selection at /', async () => {
    renderRoute('/');

    // The page loads lazily; under a full parallel test run that can take several seconds.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plays' }, { timeout: 30000 }),
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

  it('ATR-020/SCH-031: links play selection to About & licenses, listing sources and the live lookup', async () => {
    const { user } = renderRoute('/');
    await user.click(
      await screen.findByRole('link', { name: 'About & licenses' }, { timeout: 30000 }),
    );
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'About & licenses' },
        { timeout: 30000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Folger Shakespeare' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenAlex' })).toBeInTheDocument();
    expect(screen.getByText(/sends the words of the chosen lines/)).toBeInTheDocument();
  });
});
