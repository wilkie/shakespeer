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
        lazy: async () => ({
          Component: (await import('@/pages/PlaySelectionPage')).PlaySelectionPage,
        }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
  {
    path: '/plays/:playId',
    errorElement: <RouteErrorPage />,
    HydrateFallback: () => null,
    lazy: async () => ({ loader: (await import('@/features/reader/routes')).playRedirectLoader }),
  },
  {
    path: '/plays/:playId/:versionId',
    errorElement: <RouteErrorPage />,
    lazy: async () => {
      const [{ ReaderPage, ReaderLoading }, { readerLoader }] = await Promise.all([
        import('@/features/reader/ReaderPage'),
        import('@/features/reader/routes'),
      ]);
      return { loader: readerLoader, Component: ReaderPage, HydrateFallback: ReaderLoading };
    },
  },
];
