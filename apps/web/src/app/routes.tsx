import type { RouteObject } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { RouteErrorPage } from '@/app/RouteErrorPage';

/**
 * Route table. Pages are lazy-loaded so each one becomes its own chunk.
 * Kept separate from `router.tsx` so tests can mount it in a memory router.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/pages/HomePage')).HomePage }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
];
