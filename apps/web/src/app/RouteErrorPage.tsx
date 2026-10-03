import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { isRouteErrorResponse, Link as RouterLink, useRouteError } from 'react-router';

/** Rendered by the router when a route throws while loading or rendering. */
export function RouteErrorPage() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';

  return (
    <Container component="main" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Something went wrong
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {message}
      </Typography>
      <Button variant="contained" component={RouterLink} to="/">
        Return home
      </Button>
    </Container>
  );
}
