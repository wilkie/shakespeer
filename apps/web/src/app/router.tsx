import { createBrowserRouter } from 'react-router';

import { routes } from '@/app/routes';

/** Vite's base path ("/" or "/shakespeer/"), without the trailing slash React Router expects. */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(routes, { basename });
