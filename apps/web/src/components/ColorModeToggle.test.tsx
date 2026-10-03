import { describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react';

import { ColorModeToggle } from '@/components/ColorModeToggle';
import { renderWithProviders } from '@/test/render';

describe('ColorModeToggle', () => {
  it('cycles system → light → dark → system', async () => {
    const { user } = renderWithProviders(<ColorModeToggle />);

    const button = await screen.findByRole('button', { name: /color mode: system/i });
    await user.click(button);
    expect(screen.getByRole('button', { name: /color mode: light/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /color mode: dark/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /color mode: system/i })).toBeInTheDocument();
  });
});
