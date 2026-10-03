import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { AppProviders } from '@/app/AppProviders';
import { routes } from '@/app/routes';

/** Renders a UI element inside the app's providers and returns a userEvent instance. */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AppProviders, ...options }),
  };
}

/** Renders the full app route tree at the given URL using an in-memory router. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}
