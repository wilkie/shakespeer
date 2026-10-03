import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { PlayInfo } from '@shakespeer/corpus';
import {
  exportFileName,
  exportNotes,
  writeNotesArchive,
  type NotesFile,
} from '@shakespeer/storage';
import { useEffect, useState } from 'react';

import { getDatabase, getSettings } from '@/lib/storage';
import { setSetting } from '@/lib/useSetting';
import { APP_VERSION } from '@/lib/version';

import { download } from './files';

const plural = (n: number, one: string) => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

function ExportForm({ play, onClose }: { play: PlayInfo; onClose: () => void }) {
  const [name, setName] = useState('');
  const [includeImported, setIncludeImported] = useState(false);
  const [preview, setPreview] = useState<NotesFile | null>(null);
  const [failed, setFailed] = useState(false);

  // The name last used for this play, or "<Play title> notes" (IOX-002).
  useEffect(() => {
    let cancelled = false;
    void getSettings()
      .then((settings) => settings.get(`export.lastName.${play.id}`))
      .then((last) => {
        if (!cancelled) {
          setName((current) => current || (last ?? `${play.title} notes`));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [play.id, play.title]);

  // What will be exported, for the counts (IOX-003).
  useEffect(() => {
    let cancelled = false;
    void getDatabase()
      .then((db) =>
        exportNotes(db, {
          playId: play.id,
          collectionName: 'preview',
          includeImported,
          appVersion: APP_VERSION,
        }),
      )
      .then((file) => {
        if (!cancelled) {
          setPreview(file);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [play.id, includeImported]);

  const count = preview ? preview.definitions.length + preview.annotations.length : 0;
  const save = async () => {
    const collectionName = name.trim();
    try {
      const now = new Date();
      const file = await exportNotes(await getDatabase(), {
        playId: play.id,
        collectionName,
        includeImported,
        appVersion: APP_VERSION,
        now,
      });
      download(writeNotesArchive(file), exportFileName(play.id, collectionName, now));
      void setSetting(`export.lastName.${play.id}`, collectionName);
      onClose();
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Collection name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            helperText="Readers who import the file see their notes under this name."
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={includeImported}
                onChange={(event) => {
                  setIncludeImported(event.target.checked);
                }}
              />
            }
            label="Include imported notes"
          />
          {preview && (
            <Typography color="text.secondary" role="status">
              {count === 0
                ? 'There are no notes to export for this play.'
                : `${plural(preview.definitions.length, 'definition')} and ${plural(preview.annotations.length, 'annotation')} from every version of ${play.title}.`}
            </Typography>
          )}
          {failed && <Alert severity="error">The notes could not be exported. Try again.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={name.trim() === '' || count === 0}
          onClick={() => {
            void save();
          }}
        >
          Export
        </Button>
      </DialogActions>
    </>
  );
}

/** Exporting a play's notes as a .zip file (IOX-001 – IOX-005). */
export function ExportDialog({
  open,
  play,
  onClose,
}: {
  open: boolean;
  play: PlayInfo;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Export notes</DialogTitle>
      {open && <ExportForm play={play} onClose={onClose} />}
    </Dialog>
  );
}
