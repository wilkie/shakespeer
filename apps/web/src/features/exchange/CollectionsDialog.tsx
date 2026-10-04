import Edit from '@mui/icons-material/EditOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  CollectionNameTakenError,
  renameCollection,
  type CollectionSummary,
} from '@shakespeer/storage';
import { useState } from 'react';

import { getDatabase } from '@/lib/storage';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const plural = (n: number, one: string) => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

function RenameForm({ collection, onDone }: { collection: CollectionSummary; onDone: () => void }) {
  const [name, setName] = useState(collection.name);
  const [error, setError] = useState<string | undefined>();
  const save = async () => {
    try {
      await renameCollection(await getDatabase(), collection.id, name);
      onDone();
    } catch (cause) {
      setError(
        cause instanceof CollectionNameTakenError ? cause.message : 'The name could not be saved.',
      );
    }
  };
  return (
    <Stack
      component="form"
      direction="row"
      spacing={1}
      sx={{ width: '100%', alignItems: 'flex-start' }}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextField
        size="small"
        label="Collection name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        error={error !== undefined}
        helperText={error}
        sx={{ flex: 1 }}
      />
      <Button onClick={onDone}>Cancel</Button>
      <Button type="submit" variant="contained" disabled={name.trim() === ''}>
        Save
      </Button>
    </Stack>
  );
}

/** A play's imported collections, each renameable (IOX-020, IOX-021). */
export function CollectionsDialog({
  open,
  collections,
  onClose,
}: {
  open: boolean;
  collections: readonly CollectionSummary[];
  onClose: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Imported collections</DialogTitle>
      <DialogContent>
        {collections.length === 0 ? (
          <Typography color="text.secondary">
            No notes have been imported for this play. Use Import notes… to add a collection.
          </Typography>
        ) : (
          <List disablePadding>
            {collections.map((collection) => (
              <ListItem
                key={collection.id}
                disableGutters
                secondaryAction={
                  renaming === collection.id ? undefined : (
                    <IconButton
                      edge="end"
                      aria-label={`Rename ${collection.name}`}
                      onClick={() => {
                        setRenaming(collection.id);
                      }}
                    >
                      <Edit />
                    </IconButton>
                  )
                }
              >
                {renaming === collection.id ? (
                  <RenameForm
                    collection={collection}
                    onDone={() => {
                      setRenaming(null);
                    }}
                  />
                ) : (
                  <ListItemText
                    primary={collection.name}
                    secondary={`Imported ${dateFormat.format(new Date(collection.importedAt))} · ${plural(collection.definitions, 'definition')}, ${plural(collection.annotations, 'annotation')}${collection.cuts > 0 ? `, ${plural(collection.cuts, 'cut')}` : ''}`}
                  />
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
