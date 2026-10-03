import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';

export function NotFoundPage() {
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="h3" component="h1">
        Page not found
      </Typography>
      <Typography color="text.secondary">
        &ldquo;What&rsquo;s in a name?&rdquo; Not this page, it seems.
      </Typography>
      <Button variant="contained" component={RouterLink} to="/">
        Return home
      </Button>
    </Stack>
  );
}
