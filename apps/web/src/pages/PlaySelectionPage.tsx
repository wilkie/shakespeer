import UploadFile from '@mui/icons-material/UploadFileOutlined';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { listPlays, type Genre, type PlayInfo } from '@shakespeer/corpus';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';

import { ImportDialog } from '@/features/exchange/ImportDialog';
import { useFileDrop } from '@/features/exchange/useFileDrop';

const GENRES: Record<Genre, string> = {
  comedy: 'Comedy',
  tragedy: 'Tragedy',
  history: 'History',
  romance: 'Romance',
  problem: 'Problem play',
};

/** Sorts by title, ignoring a leading article ("The Tempest" under T) (SEL-003). */
function sortKey(play: PlayInfo): string {
  return play.title.replace(/^(?:the|a|an)\s+/i, '').toLowerCase();
}

function composed({ from, to }: PlayInfo['composed']): string {
  return from === to ? `c. ${String(from)}` : `c. ${String(from)}–${String(to).slice(-2)}`;
}

/** The entry page: every play in the corpus (SEL-001 – SEL-007). */
export function PlaySelectionPage() {
  const plays = [...listPlays()].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | undefined>();
  // A notes file dropped on the page opens the import (IOX-010).
  useFileDrop((file) => {
    setDroppedFile(file);
    setImporting(true);
  });
  return (
    <Stack spacing={3}>
      <title>Shakespeer</title>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-end' } }}
      >
        <div>
          <Typography variant="h3" component="h1" gutterBottom>
            Plays
          </Typography>
          <Typography color="text.secondary">Choose a play to read.</Typography>
        </div>
        <Button
          variant="outlined"
          startIcon={<UploadFile />}
          onClick={() => {
            setDroppedFile(undefined);
            setImporting(true);
          }}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}
        >
          Import notes…
        </Button>
      </Stack>
      <ImportDialog
        open={importing}
        initialFile={droppedFile}
        onClose={() => {
          setImporting(false);
        }}
        onImported={(playId) => {
          void navigate(`/plays/${playId}`);
        }}
      />
      <Stack component="ul" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {plays.map((play) => (
          <li key={play.id}>
            <Card variant="outlined">
              <CardActionArea
                component={RouterLink}
                to={`/plays/${play.id}`}
                sx={{ minHeight: 44 }}
              >
                <CardContent>
                  <Typography variant="h5" component="h2">
                    {play.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {GENRES[play.genre]} · {composed(play.composed)}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {play.versions.map((version) => (
                      <Chip key={version.id} label={version.name} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </li>
        ))}
      </Stack>
    </Stack>
  );
}
