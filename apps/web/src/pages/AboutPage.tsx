import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getSources } from '@shakespeer/corpus';
import { Link as RouterLink } from 'react-router';

import { SourceDetails } from '@/features/reader/SourceInfo';

/**
 * About & licenses (ATR-020): the app's own license, every source and its license, and what
 * leaves the reader's browser when they search OpenAlex (SCH-031).
 */
export function AboutPage() {
  return (
    <Stack spacing={3}>
      <title>About & licenses · Shakespeer</title>
      <div>
        <Typography variant="h3" component="h1" gutterBottom>
          About & licenses
        </Typography>
        <Typography color="text.secondary">
          Shakespeer is a non-commercial reader for Shakespeare’s plays. Every text, definition and
          link it ships comes from the sources below, under their licenses.
        </Typography>
      </div>

      <section>
        <Typography variant="h5" component="h2" gutterBottom>
          Shakespeer
        </Typography>
        <Typography>
          Shakespeer’s own code is licensed under the{' '}
          <Link
            href="https://www.apache.org/licenses/LICENSE-2.0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apache License 2.0
          </Link>
          . The texts, definitions and links it ships keep their own licenses, listed below; some of
          them forbid commercial use.
        </Typography>
      </section>

      <section>
        <Typography variant="h5" component="h2" gutterBottom>
          Sources
        </Typography>
        {getSources().map((source) => (
          <SourceDetails key={source.id} sourceId={source.id} />
        ))}
      </section>

      <section>
        <Typography variant="h5" component="h2" gutterBottom>
          Your notes and searches
        </Typography>
        <Typography sx={{ mb: 1 }}>
          Your notes are stored only in this browser; Shakespeer has no server.
        </Typography>
        <Typography>
          When you choose <strong>Search OpenAlex now</strong> in the Scholarship panel, Shakespeer
          sends the words of the chosen lines, at most 20 of them, to OpenAlex (api.openalex.org) to
          find works that quote them. It sends no key and nothing that identifies you. Nothing is
          sent until you ask.
        </Typography>
      </section>

      <Link component={RouterLink} to="/">
        Back to the plays
      </Link>
    </Stack>
  );
}
