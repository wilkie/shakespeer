import { describe, expect, it } from '@jest/globals';
import { screen, waitFor, within } from '@testing-library/react';

import { renderRoute } from '@/test/render';

describe('reader', () => {
  it('RDR-020/021: renders the whole version with scene headings', async () => {
    renderRoute('/plays/the-tempest/folger');

    expect(
      await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Act 5, Epilogue', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Tempest', level: 1 })).toBeInTheDocument();
  });

  it('RDR-011: the first top bar control returns to play selection', async () => {
    const { user, router } = renderRoute('/plays/the-tempest/folger');

    await user.click(await screen.findByRole('link', { name: 'All plays' }, { timeout: 10000 }));

    expect(router.state.location.pathname).toBe('/');
  });

  it('MAP-022/023/024: labels scene buttons with their destination', async () => {
    renderRoute('/plays/the-tempest/folger');

    const scenes = await screen.findByRole('navigation', { name: 'Scenes' }, { timeout: 10000 });
    expect(within(scenes).getByRole('button', { name: 'Next: Act 1, Scene 2' })).toBeEnabled();
    expect(within(scenes).getByRole('button', { name: 'No previous scene' })).toBeDisabled();
  });

  it('DEF-030/031: activating a term opens its definitions with their source', async () => {
    const { user } = renderRoute('/plays/the-tempest/folger');
    await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 10000 });

    const term = document.querySelector<HTMLElement>('.term');
    expect(term).not.toBeNull();
    await user.click(term as HTMLElement);

    const panel = await screen.findByRole('complementary', { name: 'Notes' });
    expect(within(panel).getByText(/Source:/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Schmidt' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Notes' })).not.toBeInTheDocument();
    });
  });

  it('DEF-032/034: revealing underlines makes terms keyboard-focusable', async () => {
    const { user } = renderRoute('/plays/the-tempest/folger');
    await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 10000 });
    expect(document.querySelector('.term')).not.toHaveAttribute('tabindex');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Show definition underlines' }));

    await waitFor(() => {
      expect(document.querySelector('.term')).toHaveAttribute('tabindex', '0');
    });
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Show definition underlines' }));
  });

  it('ATR-002: ends with information about the text and its license', async () => {
    renderRoute('/plays/the-tempest/folger');

    expect(
      await screen.findByRole('heading', { name: 'About this text' }, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'CC BY-NC 3.0 Unported' }).length).toBeGreaterThan(
      0,
    );
  });

  it('RDR-001: unknown versions show the not-found page', async () => {
    renderRoute('/plays/the-tempest/q9');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('RDR-041: a play without a version opens its modern version', async () => {
    const { router } = renderRoute('/plays/the-tempest');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/plays/the-tempest/folger');
    });
  });
});
