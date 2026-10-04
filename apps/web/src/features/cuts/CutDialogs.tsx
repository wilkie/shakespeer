import ContentCopy from '@mui/icons-material/ContentCopyOutlined';
import Delete from '@mui/icons-material/DeleteOutlined';
import Edit from '@mui/icons-material/EditOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { VersionIndex } from '@shakespeer/corpus';
import {
  CutNameTakenError,
  deleteCut,
  saveCut,
  type CutOperation,
  type CutRecord,
} from '@shakespeer/storage';
import { useState } from 'react';

import { truncate } from '@/features/notes/format';
import { ConfirmDelete } from '@/features/notes/ConfirmDelete';
import { useFocusOnMount } from '@/features/notes/useFocusOnMount';
import { getDatabase } from '@/lib/storage';

import { resolveOperations } from './display';

const plural = (n: number, one: string) => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/** Asks for a cut's name, required and unique per version (CUT-021). */
function NameForm({
  initial,
  label,
  submit,
  onCancel,
  onSave,
}: {
  initial: string;
  label: string;
  submit: string;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const inputRef = useFocusOnMount<HTMLInputElement>(true);
  const save = async () => {
    try {
      await onSave(name.trim());
    } catch (cause) {
      setError(cause instanceof CutNameTakenError ? cause.message : 'The cut could not be saved.');
    }
  };
  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() !== '') {
          void save();
        }
      }}
    >
      <TextField
        inputRef={inputRef}
        label={label}
        value={name}
        required
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        error={error !== undefined}
        helperText={error}
      />
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={name.trim() === ''}>
          {submit}
        </Button>
      </Stack>
    </Stack>
  );
}

function newCut(playId: string, versionId: string, name: string, operations: CutOperation[] = []) {
  const now = new Date().toISOString();
  const cut: CutRecord = {
    id: crypto.randomUUID(),
    playId,
    versionId,
    name,
    origin: { kind: 'own' },
    createdAt: now,
    updatedAt: now,
    operations,
  };
  return cut;
}

/** New cut… (CUT-021): opens the new cut in edit mode. */
export function NewCutDialog({
  open,
  playId,
  versionId,
  onClose,
  onCreated,
}: {
  open: boolean;
  playId: string;
  versionId: string;
  onClose: () => void;
  onCreated: (cut: CutRecord) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New cut</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {open && (
          <NameForm
            initial=""
            label="Name"
            submit="Create"
            onCancel={onClose}
            onSave={async (name) => {
              const cut = await saveCut(await getDatabase(), newCut(playId, versionId, name));
              onCreated(cut);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Study cut (copy)", "Study cut (copy 2)", … not yet taken. */
function copyName(name: string, taken: ReadonlySet<string>): string {
  for (let n = 1; ; n += 1) {
    const candidate = `${name} (copy${n === 1 ? '' : ` ${String(n)}`})`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

function operationLabel(op: CutOperation): string {
  switch (op.type) {
    case 'hide':
      return `Cut: “${truncate(op.anchor.quote.exact, 50)}”`;
    case 'replace':
      return `Replaced: “${truncate(op.anchor.quote.exact, 40)}” with “${truncate(op.text, 30)}”`;
    case 'insert':
      return `Added: “${truncate(op.text, 50)}”`;
  }
}

/**
 * Manage cuts… (CUT-021): each cut with its number of changes, renamed, duplicated or deleted;
 * changes whose text cannot be found are listed to delete (CUT-050).
 */
export function ManageCutsDialog({
  open,
  cuts,
  index,
  onClose,
}: {
  open: boolean;
  cuts: readonly CutRecord[];
  index: VersionIndex;
  onClose: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CutRecord | null>(null);
  const names = new Set(cuts.map((cut) => cut.name));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cuts</DialogTitle>
      <DialogContent>
        {cuts.length === 0 ? (
          <Typography color="text.secondary">
            This version has no cuts yet. Use New cut… to make one.
          </Typography>
        ) : (
          <List disablePadding>
            {cuts.map((cut) => {
              const { unattached } = resolveOperations(index, cut.operations);
              return (
                <ListItem
                  key={cut.id}
                  disableGutters
                  sx={{ flexWrap: 'wrap' }}
                  secondaryAction={
                    renaming === cut.id ? undefined : (
                      <Stack direction="row">
                        <Tooltip title="Rename">
                          <IconButton
                            aria-label={`Rename ${cut.name}`}
                            onClick={() => {
                              setRenaming(cut.id);
                            }}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <IconButton
                            aria-label={`Duplicate ${cut.name}`}
                            onClick={() => {
                              void getDatabase().then((db) =>
                                saveCut(
                                  db,
                                  newCut(
                                    cut.playId,
                                    cut.versionId,
                                    copyName(cut.name, names),
                                    cut.operations,
                                  ),
                                ),
                              );
                            }}
                          >
                            <ContentCopy />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            edge="end"
                            aria-label={`Delete ${cut.name}`}
                            onClick={() => {
                              setDeleting(cut);
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )
                  }
                >
                  {renaming === cut.id ? (
                    <NameForm
                      initial={cut.name}
                      label="Cut name"
                      submit="Save"
                      onCancel={() => {
                        setRenaming(null);
                      }}
                      onSave={async (name) => {
                        await saveCut(await getDatabase(), { ...cut, name });
                        setRenaming(null);
                      }}
                    />
                  ) : (
                    <ListItemText
                      primary={cut.name}
                      secondary={`${plural(cut.operations.length, 'change')}${
                        unattached.length > 0
                          ? ` · ${String(unattached.length)} can’t be found in the text`
                          : ''
                      }`}
                      sx={{ pr: 18 }}
                    />
                  )}
                  {renaming !== cut.id && unattached.length > 0 && (
                    <List dense disablePadding sx={{ width: '100%', pl: 2 }}>
                      {unattached.map((op) => (
                        <ListItem
                          key={op.id}
                          disableGutters
                          secondaryAction={
                            <Button
                              size="small"
                              onClick={() => {
                                void getDatabase().then((db) =>
                                  saveCut(db, {
                                    ...cut,
                                    operations: cut.operations.filter((o) => o.id !== op.id),
                                  }),
                                );
                              }}
                            >
                              Delete
                            </Button>
                          }
                        >
                          <ListItemText
                            secondary={operationLabel(op)}
                            sx={{ pr: 10, color: 'text.secondary' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <ConfirmDelete
        open={deleting !== null}
        title="Delete this cut?"
        description={`“${deleting?.name ?? ''}” and its ${plural(deleting?.operations.length ?? 0, 'change')} will be deleted. Notes are not affected.`}
        onCancel={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          const cut = deleting;
          setDeleting(null);
          if (cut) {
            void getDatabase().then((db) => deleteCut(db, cut.id));
          }
        }}
      />
    </Dialog>
  );
}

export type CutTextRequest =
  | { kind: 'replace'; original: string; text: string }
  | { kind: 'insert'; text: string; insertKind: 'sd' | 'narration'; editing: boolean };

/** New wording for a span (Replace…) or added text (Insert after…), or editing either (CUT-031, CUT-033). */
export function CutTextDialog({
  request,
  onClose,
  onSave,
}: {
  request: CutTextRequest | null;
  onClose: () => void;
  onSave: (text: string, insertKind: 'sd' | 'narration') => void;
}) {
  return (
    <Dialog open={request !== null} onClose={onClose} maxWidth="sm" fullWidth>
      {request && <CutTextForm request={request} onClose={onClose} onSave={onSave} />}
    </Dialog>
  );
}

function CutTextForm({
  request,
  onClose,
  onSave,
}: {
  request: CutTextRequest;
  onClose: () => void;
  onSave: (text: string, insertKind: 'sd' | 'narration') => void;
}) {
  const [text, setText] = useState(request.text);
  const inputRef = useFocusOnMount<HTMLTextAreaElement>(true);
  const [insertKind, setInsertKind] = useState<'sd' | 'narration'>(
    request.kind === 'insert' ? request.insertKind : 'sd',
  );
  const title =
    request.kind === 'replace'
      ? 'Replace wording'
      : request.editing
        ? 'Edit added text'
        : 'Insert after this line';
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim() !== '') {
          onSave(text.trim(), insertKind);
        }
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {request.kind === 'replace' && (
            <Typography color="text.secondary">
              Replacing “{truncate(request.original, 120)}”
            </Typography>
          )}
          {request.kind === 'insert' && !request.editing && (
            <RadioGroup
              row
              value={insertKind}
              onChange={(event) => {
                setInsertKind(event.target.value as 'sd' | 'narration');
              }}
            >
              <FormControlLabel value="sd" control={<Radio />} label="Stage direction" />
              <FormControlLabel value="narration" control={<Radio />} label="Narration" />
            </RadioGroup>
          )}
          <TextField
            inputRef={inputRef}
            multiline
            minRows={2}
            label={request.kind === 'replace' ? 'New wording' : 'Text'}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={text.trim() === ''}>
          Save
        </Button>
      </DialogActions>
    </form>
  );
}
