import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/DeleteOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { getSource, type PartOfSpeech, type TextAnchor } from '@shakespeer/corpus';
import type { DefinitionRecord } from '@shakespeer/storage';
import { useState } from 'react';

import { ConfirmDelete } from './ConfirmDelete';
import { originLabel, truncate } from './format';
import type { TermGroup } from './noteIndex';
import { useAutosave } from './useAutosave';
import { useFocusOnMount } from './useFocusOnMount';

const PARTS_OF_SPEECH: { value: PartOfSpeech; label: string; short: string }[] = [
  { value: 'noun', label: 'Noun', short: 'noun' },
  { value: 'verb', label: 'Verb', short: 'verb' },
  { value: 'adjective', label: 'Adjective', short: 'adj.' },
  { value: 'adverb', label: 'Adverb', short: 'adv.' },
  { value: 'pronoun', label: 'Pronoun', short: 'pron.' },
  { value: 'preposition', label: 'Preposition', short: 'prep.' },
  { value: 'conjunction', label: 'Conjunction', short: 'conj.' },
  { value: 'interjection', label: 'Interjection', short: 'interj.' },
  { value: 'phrase', label: 'Phrase', short: 'phrase' },
  { value: 'other', label: 'Other', short: '' },
];

const shortPos = (pos: PartOfSpeech | undefined) =>
  PARTS_OF_SPEECH.find((p) => p.value === pos)?.short ?? '';

function Meaning({
  meaning,
  partOfSpeech,
}: {
  meaning: string;
  partOfSpeech: PartOfSpeech | undefined;
}) {
  const pos = shortPos(partOfSpeech);
  return (
    <>
      {pos && (
        <Typography component="span" variant="body2" sx={{ fontStyle: 'italic', mr: 0.75 }}>
          {pos}
        </Typography>
      )}
      {meaning}
    </>
  );
}

/** Editing one own or imported definition, saving as it goes (DEF-022, PNL-022). */
function DefinitionEditor({
  record,
  focus,
  onSave,
  onDelete,
}: {
  record: DefinitionRecord;
  focus: boolean;
  onSave: (record: DefinitionRecord) => void;
  onDelete: (record: DefinitionRecord) => void;
}) {
  const [draft, update, flush] = useAutosave(record, (value) => {
    // A definition exists once it has a meaning (PNL-025).
    if (value.meaning.trim() !== '') {
      onSave(value);
    }
  });
  const [confirming, setConfirming] = useState(false);
  const meaningRef = useFocusOnMount<HTMLTextAreaElement>(focus);
  return (
    <Stack spacing={1} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <TextField
        label="Meaning"
        multiline
        minRows={2}
        size="small"
        inputRef={meaningRef}
        value={draft.meaning}
        onChange={(event) => {
          update({ ...draft, meaning: event.target.value });
        }}
        onBlur={flush}
      />
      <Stack direction="row" spacing={1}>
        <TextField
          select
          size="small"
          label="Part of speech"
          value={draft.partOfSpeech ?? ''}
          onChange={(event) => {
            const value = event.target.value as PartOfSpeech | '';
            const { partOfSpeech: _old, ...rest } = draft;
            update(value ? { ...rest, partOfSpeech: value } : rest);
          }}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {PARTS_OF_SPEECH.map((pos) => (
            <MenuItem key={pos.value} value={pos.value}>
              {pos.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Source"
          placeholder="e.g. OED"
          value={draft.source ?? ''}
          onChange={(event) => {
            const { source: _old, ...rest } = draft;
            update(event.target.value ? { ...rest, source: event.target.value } : rest);
          }}
          onBlur={flush}
          sx={{ flex: 1 }}
        />
        <IconButton
          aria-label="Delete definition"
          onClick={() => {
            setConfirming(true);
          }}
        >
          <Delete />
        </IconButton>
      </Stack>
      <ConfirmDelete
        open={confirming}
        title="Delete definition?"
        description={
          draft.meaning
            ? `“${truncate(draft.meaning, 120)}” will be deleted.`
            : 'This empty definition will be deleted.'
        }
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          onDelete(draft);
        }}
      />
    </Stack>
  );
}

export interface TermEntryProps {
  anchor: TextAnchor;
  group: TermGroup | undefined;
  /** New definitions not yet saved (DEF-021). */
  drafts: readonly DefinitionRecord[];
  editing: boolean;
  focusId: string | undefined;
  onAddDefinition: () => void;
  onSave: (record: DefinitionRecord) => void;
  onDelete: (record: DefinitionRecord) => void;
  onSource: (sourceId: string) => void;
}

/**
 * A term and its definitions: own, then imported, then sourced by source (DEF-031). In edit mode
 * own and imported definitions are editable, and new ones can be added; sourced definitions never
 * are (DEF-011).
 */
export function TermEntry({
  anchor,
  group,
  drafts,
  editing,
  focusId,
  onAddDefinition,
  onSave,
  onDelete,
  onSource,
}: TermEntryProps) {
  const definitions = group?.definitions ?? [];
  const own = definitions.filter((d) => d.origin.kind === 'own');
  const imported = definitions.filter((d) => d.origin.kind === 'imported');
  const pendingDrafts = drafts.filter((draft) => !definitions.some((d) => d.id === draft.id));
  const sourced = group?.sourced ?? [];

  return (
    <Box component="article" sx={{ py: 1 }}>
      <Typography variant="overline" color="text.secondary">
        Definition
      </Typography>
      <Typography variant="h6" component="h3" sx={{ fontStyle: 'italic', mb: 1 }}>
        “{truncate(anchor.quote.exact)}”
      </Typography>

      {editing ? (
        <Stack spacing={1.5} sx={{ mb: 1.5 }}>
          {[...own, ...pendingDrafts, ...imported].map((record) => (
            <DefinitionEditor
              key={record.id}
              record={record}
              focus={record.id === focusId}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
          <Button
            size="small"
            startIcon={<Add />}
            onClick={onAddDefinition}
            sx={{ alignSelf: 'flex-start' }}
          >
            Add definition
          </Button>
        </Stack>
      ) : (
        [...own, ...imported].map((record) => (
          <Box key={record.id} sx={{ mb: 1.5 }}>
            <Typography>
              <Meaning meaning={record.meaning} partOfSpeech={record.partOfSpeech} />
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {record.source ? `${record.source} · ` : ''}
              {originLabel(record.origin)}
            </Typography>
          </Box>
        ))
      )}

      {sourced.map(({ sourceId, term }) => (
        <Box key={term.id} sx={{ mb: 1.5 }}>
          <Stack component="ol" spacing={1} sx={{ pl: 2.5, my: 0 }}>
            {term.definitions.map((definition, i) => (
              <Typography component="li" key={i}>
                <Meaning meaning={definition.meaning} partOfSpeech={definition.partOfSpeech} />
              </Typography>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
            {term.headword !== anchor.quote.exact && <>Headword “{term.headword}”. </>}
            Source:{' '}
            <Link
              component="button"
              variant="caption"
              onClick={() => {
                onSource(sourceId);
              }}
            >
              {getSource(sourceId)?.shortName ?? sourceId}
            </Link>
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
