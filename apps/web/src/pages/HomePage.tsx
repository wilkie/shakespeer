import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function HomePage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h2" component="h1">
        Shakespeer
      </Typography>
      <Typography variant="h5" component="p" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        &ldquo;All the world&rsquo;s a stage, and all the men and women merely players.&rdquo;
      </Typography>
      <Typography>Read and explore the complete plays of William Shakespeare.</Typography>
    </Stack>
  );
}
