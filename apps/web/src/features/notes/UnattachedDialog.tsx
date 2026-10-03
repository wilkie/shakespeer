import Delete from '@mui/icons-material/DeleteOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { TextAnchor } from '@shakespeer/corpus';
import { deleteNote, saveNote } from '@shakespeer/storage';
import { useState } from 'react';

import { getDatabase } from '@/lib/storage';

import { useCollectionName } from './collectionNames';
import { ConfirmDelete } from './ConfirmDelete';
import { originLabel, truncate } from './format';
import type { UnattachedNote } from './useVersionNotes';

function describe({ kind, record }: UnattachedNote): string {
  if (kind === 'definitions' && 'meaning' in record) {
    return `Definition: ${truncate(record.meaning, 120)}`;
  }
  return 'notes' in record && record.notes.trim()
    ? `Annotation: ${truncate(record.notes, 120)}`
    : 'Annotation';
}

/** Notes whose text can no longer be found, kept rather than lost (ANC-032, IOX-017). */
export function UnattachedDialog({
  open,
  notes,
  selection,
  onClose,
}: {
  open: boolean;
  notes: readonly UnattachedNote[];
  /** The text selected in the play when the list opened, if any. */
  selection: TextAnchor | undefined;
  onClose: () => void;
}) {
  const collectionName = useCollectionName();
  const [deleting, setDeleting] = useState<UnattachedNote | null>(null);

  /** Moves a note to the selected text: the reader's own edit (ANC-032, DEF-024). */
  const attach = async ({ kind, record }: UnattachedNote, anchor: TextAnchor) => {
    const db = await getDatabase();
    if (kind === 'definitions' && 'meaning' in record) {
      await saveNote(db, 'definitions', { ...record, anchor });
    } else if ('color' in record) {
      await saveNote(db, 'annotations', { ...record, anchor });
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Unattached notes</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          The text these notes were attached to could not be found in this version, so they are not
          shown in the play.
        </Typography>
        {notes.length === 0 ? (
          <Typography>Every note is attached to its text.</Typography>
        ) : !selection ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            To attach a note to new text, select the text in the play, then open this list again.
          </Typography>
        ) : null}
        {notes.length > 0 && (
          <List disablePadding>
            {notes.map((note) => (
              <ListItem
                key={note.record.id}
                disableGutters
                secondaryAction={
                  <>
                    <Button
                      size="small"
                      disabled={!selection}
                      onClick={() => {
                        if (selection) {
                          void attach(note, selection);
                        }
                      }}
                    >
                      Attach to selection
                    </Button>
                    <IconButton
                      edge="end"
                      aria-label={`Delete note on “${truncate(note.record.anchor.quote.exact, 40)}”`}
                      onClick={() => {
                        setDeleting(note);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </>
                }
                sx={{ pr: 22 }}
              >
                <ListItemText
                  primary={`“${truncate(note.record.anchor.quote.exact)}”`}
                  secondary={`${describe(note)} · ${originLabel(note.record.origin, collectionName)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <ConfirmDelete
        open={deleting !== null}
        title="Delete note?"
        description={`The note on “${truncate(deleting?.record.anchor.quote.exact ?? '', 100)}” will be deleted.`}
        onCancel={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          const note = deleting;
          setDeleting(null);
          if (note) {
            void getDatabase().then((db) => deleteNote(db, note.kind, note.record.id));
          }
        }}
      />
    </Dialog>
  );
}
