import UploadFile from '@mui/icons-material/UploadFileOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { applyImport, findCollection, type ImportReport } from '@shakespeer/storage';
import { useEffect, useRef, useState } from 'react';

import { getDatabase } from '@/lib/storage';

import { prepareImport, type ImportPlan } from './prepareImport';

type Step =
  | { kind: 'choose' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'summary'; plan: ImportPlan }
  | { kind: 'importing'; plan: ImportPlan }
  | { kind: 'done'; plan: ImportPlan; report: ImportReport };

const plural = (n: number, one: string, many = `${one}s`) => `${String(n)} ${n === 1 ? one : many}`;

function Summary({
  plan,
  currentPlayId,
  mode,
  onMode,
  newName,
  onNewName,
  nameError,
  restore,
  onRestore,
}: {
  plan: ImportPlan;
  currentPlayId: string | undefined;
  mode: 'update' | 'new';
  onMode: (mode: 'update' | 'new') => void;
  newName: string;
  onNewName: (name: string) => void;
  nameError: string | undefined;
  restore: boolean;
  onRestore: (restore: boolean) => void;
}) {
  const { file, play, versions, notes, unattached, existing } = plan;
  const skipped = notes.skipped.unknownVersion + notes.skipped.tooLong;
  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="overline" color="text.secondary">
          Collection
        </Typography>
        <Typography variant="h6" component="p">
          {file.collection.name}
        </Typography>
        <Typography color="text.secondary">for {play.title}</Typography>
      </div>
      {currentPlayId !== undefined && currentPlayId !== play.id && (
        <Alert severity="info">
          These notes are for {play.title}, not the play you have open. It will open after
          importing.
        </Alert>
      )}
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {versions.map((v) => (
          <li key={v.versionId}>
            <Typography>
              {v.name}: {plural(v.definitions, 'definition')}, {plural(v.annotations, 'annotation')}
            </Typography>
          </li>
        ))}
        {versions.length === 0 && (
          <li>
            <Typography>No notes this app can show.</Typography>
          </li>
        )}
      </Box>
      {skipped > 0 && (
        <Alert severity="warning">
          {plural(skipped, 'note')} will be skipped
          {notes.skipped.unknownVersion > 0 &&
            ` (${String(notes.skipped.unknownVersion)} for versions this app does not have)`}
          {notes.skipped.tooLong > 0 && ` (${String(notes.skipped.tooLong)} too long)`}.
        </Alert>
      )}
      {unattached > 0 && (
        <Alert severity="warning">
          The text of {plural(unattached, 'note')} could not be found. They will be imported and
          listed under Unattached notes.
        </Alert>
      )}
      {existing && (
        <Stack spacing={1}>
          <Typography>
            You already imported a collection named “{existing.name}” for this play.
          </Typography>
          <RadioGroup
            value={mode}
            onChange={(event) => {
              onMode(event.target.value as 'update' | 'new');
            }}
          >
            <FormControlLabel
              value="update"
              control={<Radio />}
              label={`Update “${existing.name}”, keeping notes you changed`}
            />
            <FormControlLabel value="new" control={<Radio />} label="Import as a new collection" />
          </RadioGroup>
          {mode === 'update' && plan.deletedInFile > 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={restore}
                  onChange={(event) => {
                    onRestore(event.target.checked);
                  }}
                />
              }
              label={`Restore the ${plural(plan.deletedInFile, 'note')} you deleted`}
            />
          )}
          {mode === 'new' && (
            <TextField
              label="New collection name"
              size="small"
              value={newName}
              onChange={(event) => {
                onNewName(event.target.value);
              }}
              error={nameError !== undefined}
              helperText={nameError}
              required
            />
          )}
        </Stack>
      )}
    </Stack>
  );
}

function ReportView({ report }: { report: ImportReport }) {
  const lines = [
    report.added > 0 && `${plural(report.added, 'note')} added`,
    report.updated > 0 && `${plural(report.updated, 'note')} updated`,
    report.removed > 0 && `${plural(report.removed, 'note')} removed`,
    report.keptModified > 0 &&
      `${plural(report.keptModified, 'note')} kept because you changed them`,
    report.restored > 0 && `${plural(report.restored, 'note')} you had deleted restored`,
    report.previouslyDeleted > 0 &&
      `${plural(report.previouslyDeleted, 'note')} you had deleted left out`,
  ].filter((line): line is string => Boolean(line));
  return (
    <Stack spacing={1}>
      <Typography>Import complete.</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {(lines.length > 0 ? lines : ['Nothing changed']).map((line) => (
          <li key={line}>
            <Typography>{line}.</Typography>
          </li>
        ))}
      </Box>
    </Stack>
  );
}

export interface ImportDialogProps {
  open: boolean;
  /** A file dropped on the page, to start with (IOX-010). */
  initialFile?: File | undefined;
  /** The play open in the reader, if any (IOX-013). */
  currentPlayId?: string | undefined;
  onClose: () => void;
  /** Called when the reader closes the report of a successful import, with its play. */
  onImported?: (playId: string) => void;
}

/** Importing a notes file: choose, check, confirm, report (IOX-010 – IOX-017). */
export function ImportDialog(props: ImportDialogProps) {
  // Each opening starts over, with the dropped file if there is one.
  return props.open ? <ImportFlow {...props} /> : null;
}

function ImportFlow({ initialFile, currentPlayId, onClose, onImported }: ImportDialogProps) {
  const [step, setStep] = useState<Step>(initialFile ? { kind: 'reading' } : { kind: 'choose' });
  const [mode, setMode] = useState<'update' | 'new'>('update');
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [restore, setRestore] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  /** Shows the summary for a checked file, or why it cannot be imported. */
  const settle = (prepared: Promise<ImportPlan>) =>
    prepared.then(
      (plan) => {
        setMode('update');
        setNewName(`${plan.file.collection.name} (2)`);
        setNameError(undefined);
        setStep({ kind: 'summary', plan });
      },
      (error: unknown) => {
        setStep({
          kind: 'error',
          message: error instanceof Error ? error.message : 'The file could not be read.',
        });
      },
    );

  const read = (file: File) => {
    setStep({ kind: 'reading' });
    void settle(prepareImport(file));
  };

  // The file the dialog opened with, if one was dropped.
  const [initial] = useState(() => (initialFile ? prepareImport(initialFile) : undefined));
  useEffect(() => {
    if (initial) {
      void settle(initial);
    }
  }, [initial]);

  const confirm = async (plan: ImportPlan) => {
    const db = await getDatabase();
    let target: Parameters<typeof applyImport>[3];
    if (plan.existing && mode === 'update') {
      target = { mode: 'update', collectionId: plan.existing.id, restoreDeleted: restore };
    } else {
      const name = plan.existing ? newName.trim() : plan.file.collection.name;
      if (!name) {
        setNameError('Enter a name.');
        return;
      }
      if (await findCollection(db, plan.play.id, name)) {
        setNameError('A collection with this name already exists.');
        return;
      }
      target = { mode: 'new', collectionName: name };
    }
    setStep({ kind: 'importing', plan });
    try {
      const report = await applyImport(db, plan.play.id, plan.notes, target, plan.fileName);
      setStep({ kind: 'done', plan, report });
    } catch {
      setStep({ kind: 'error', message: 'The notes could not be saved. Nothing was imported.' });
    }
  };

  const busy = step.kind === 'reading' || step.kind === 'importing';
  return (
    <Dialog
      open
      onClose={() => {
        if (step.kind === 'done') {
          onClose();
          onImported?.(step.plan.play.id);
        } else if (!busy) {
          onClose();
        }
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Import notes</DialogTitle>
      <DialogContent>
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          hidden
          data-testid="import-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              read(file);
            }
          }}
        />
        {(step.kind === 'choose' || step.kind === 'error') && (
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            {step.kind === 'error' && <Alert severity="error">{step.message}</Alert>}
            <Typography color="text.secondary">
              Choose a .zip notes file exported from Shakespeer, or drop one on the page.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<UploadFile />}
              onClick={() => {
                input.current?.click();
              }}
            >
              Choose file…
            </Button>
          </Stack>
        )}
        {busy && (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', py: 2 }}>
            <CircularProgress size={24} />
            <Typography>{step.kind === 'reading' ? 'Checking the file…' : 'Importing…'}</Typography>
          </Stack>
        )}
        {step.kind === 'summary' && (
          <Summary
            plan={step.plan}
            currentPlayId={currentPlayId}
            mode={mode}
            onMode={setMode}
            newName={newName}
            onNewName={(name) => {
              setNewName(name);
              setNameError(undefined);
            }}
            nameError={nameError}
            restore={restore}
            onRestore={setRestore}
          />
        )}
        {step.kind === 'done' && <ReportView report={step.report} />}
      </DialogContent>
      <DialogActions>
        {step.kind === 'done' ? (
          <Button
            variant="contained"
            onClick={() => {
              onClose();
              onImported?.(step.plan.play.id);
            }}
          >
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            {step.kind === 'summary' && (
              <Button
                variant="contained"
                onClick={() => {
                  void confirm(step.plan);
                }}
              >
                {step.plan.existing && mode === 'update'
                  ? `Update “${step.plan.existing.name}”`
                  : 'Import'}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
