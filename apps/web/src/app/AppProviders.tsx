import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { theme } from '@/theme/theme';

export interface AppProvidersProps {
  children: ReactNode;
}

/** Global context providers shared by the app and by tests. */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
