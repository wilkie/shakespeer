import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Outlet, Link as RouterLink } from 'react-router';

import { ColorModeToggle } from '@/components/ColorModeToggle';

/** Application shell: header, skip link and the routed page content. */
export function AppLayout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <Link
        href="#main-content"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: (theme) => theme.zIndex.tooltip,
          p: 1,
          bgcolor: 'background.paper',
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Link>

      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}
          >
            Shakespeer
          </Typography>
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      <Container component="main" id="main-content" tabIndex={-1} sx={{ flexGrow: 1, py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
