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
  exportCuts,
  exportFileName,
  exportNotes,
  writeNotesArchive,
  type CutsFile,
  type NotesFile,
} from '@shakespeer/storage';
import { useEffect, useState } from 'react';

import { getDatabase, getSettings } from '@/lib/storage';
import { setSetting } from '@/lib/useSetting';
import { APP_VERSION } from '@/lib/version';

import { download } from './files';

const plural = (n: number, one: string) => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/** The play's notes and, if asked, its cuts, as an archive (IOX-004, CUT-052). */
async function exportArchive(
  playId: string,
  collectionName: string,
  includeImported: boolean,
  includeCuts: boolean,
  now: Date,
): Promise<Uint8Array> {
  const db = await getDatabase();
  const file = await exportNotes(db, {
    playId,
    collectionName,
    includeImported,
    appVersion: APP_VERSION,
    now,
  });
  if (!includeCuts) {
    return writeNotesArchive(file);
  }
  return writeNotesArchive(file, await exportCuts(db, { playId, includeImported }));
}

function ExportForm({ play, onClose }: { play: PlayInfo; onClose: () => void }) {
  const [name, setName] = useState('');
  const [includeImported, setIncludeImported] = useState(false);
  const [preview, setPreview] = useState<{ notes: NotesFile; cuts: CutsFile } | null>(null);
  /** On by default when the play has cuts (CUT-052); null until the reader chooses. */
  const [includeCutsChoice, setIncludeCuts] = useState<boolean | null>(null);
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
      .then(async (db) => ({
        notes: await exportNotes(db, {
          playId: play.id,
          collectionName: 'preview',
          includeImported,
          appVersion: APP_VERSION,
        }),
        cuts: await exportCuts(db, { playId: play.id, includeImported }),
      }))
      .then((file) => {
        if (!cancelled) {
          setPreview(file);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [play.id, includeImported]);

  const hasCuts = (preview?.cuts.cuts.length ?? 0) > 0;
  const includeCuts = hasCuts && (includeCutsChoice ?? true);
  const cutCount = includeCuts ? (preview?.cuts.cuts.length ?? 0) : 0;
  const noteCount = preview
    ? preview.notes.definitions.length + preview.notes.annotations.length
    : 0;
  const count = noteCount + cutCount;
  const save = async () => {
    const collectionName = name.trim();
    try {
      const now = new Date();
      const archive = await exportArchive(
        play.id,
        collectionName,
        includeImported,
        includeCuts,
        now,
      );
      download(archive, exportFileName(play.id, collectionName, now));
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
          {hasCuts && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeCuts}
                  onChange={(event) => {
                    setIncludeCuts(event.target.checked);
                  }}
                />
              }
              label="Include cuts"
            />
          )}
          {preview && (
            <Typography color="text.secondary" role="status">
              {count === 0
                ? 'There are no notes to export for this play.'
                : `${plural(preview.notes.definitions.length, 'definition')}${cutCount > 0 ? ', ' : ' and '}${plural(preview.notes.annotations.length, 'annotation')}${cutCount > 0 ? ` and ${plural(cutCount, 'cut')}` : ''} from every version of ${play.title}.`}
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
