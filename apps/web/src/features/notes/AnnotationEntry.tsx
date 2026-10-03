import Check from '@mui/icons-material/Check';
import Delete from '@mui/icons-material/DeleteOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { AnnotationRecord, HighlightColor } from '@shakespeer/storage';
import { useState, type ReactNode } from 'react';

import { CitationsEditor, CitationView } from './CitationsEditor';
import { ConfirmDelete } from './ConfirmDelete';
import { originLabel, truncate } from './format';
import { isSafeUrl, linkText } from './links';
import { LinksEditor } from './LinksEditor';
import { MarkdownView } from './MarkdownView';
import { HIGHLIGHT_COLORS, HIGHLIGHTS, highlightVar } from './palette';
import { useAutosave } from './useAutosave';
import { useFocusOnMount } from './useFocusOnMount';

/** The palette as swatches; the color's name is always available, not only its hue (ANN-012). */
function ColorPicker({
  value,
  onChange,
}: {
  value: HighlightColor;
  onChange: (color: HighlightColor) => void;
}) {
  return (
    <Stack direction="row" spacing={1} role="radiogroup" aria-label="Highlight color">
      {HIGHLIGHT_COLORS.map((color) => (
        <ButtonBase
          key={color}
          role="radio"
          aria-checked={color === value}
          aria-label={HIGHLIGHTS[color].name}
          title={HIGHLIGHTS[color].name}
          onClick={() => {
            onChange(color);
          }}
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: highlightVar(color),
            border: 2,
            borderColor: color === value ? 'text.primary' : 'divider',
          }}
        >
          {color === value && <Check fontSize="small" />}
        </ButtonBase>
      ))}
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="h4">
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** Saved form of a draft: links must be http(s) to be kept (ANN-003). */
function forSaving(record: AnnotationRecord): AnnotationRecord {
  return { ...record, links: record.links.filter((link) => isSafeUrl(link.url)) };
}

function AnnotationEditor({
  record,
  focusNotes,
  onSave,
  onDelete,
}: {
  record: AnnotationRecord;
  focusNotes: boolean;
  onSave: (record: AnnotationRecord) => void;
  onDelete: (record: AnnotationRecord) => void;
}) {
  const [draft, update, flush] = useAutosave(record, (value) => {
    onSave(forSaving(value));
  });
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const notesRef = useFocusOnMount<HTMLTextAreaElement>(focusNotes);
  const [confirming, setConfirming] = useState(false);

  return (
    <Stack spacing={2}>
      <ColorPicker
        value={draft.color}
        onChange={(color) => {
          update({ ...draft, color });
        }}
      />
      <Section title="Notes">
        <Tabs
          value={tab}
          onChange={(_, next: 'write' | 'preview') => {
            setTab(next);
          }}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0 } }}
        >
          <Tab value="write" label="Write" />
          <Tab value="preview" label="Preview" />
        </Tabs>
        {tab === 'write' ? (
          <TextField
            multiline
            minRows={4}
            fullWidth
            size="small"
            inputRef={notesRef}
            placeholder="Notes (Markdown)"
            slotProps={{ htmlInput: { 'aria-label': 'Notes' } }}
            value={draft.notes}
            onChange={(event) => {
              update({ ...draft, notes: event.target.value });
            }}
            onBlur={flush}
            sx={{ mt: 1 }}
          />
        ) : (
          <Box sx={{ mt: 1, minHeight: 80 }}>
            {draft.notes.trim() ? (
              <MarkdownView source={draft.notes} />
            ) : (
              <Typography color="text.secondary">Nothing to preview.</Typography>
            )}
          </Box>
        )}
      </Section>
      <Section title="Links">
        <LinksEditor
          links={draft.links}
          onChange={(links) => {
            update({ ...draft, links });
          }}
        />
      </Section>
      <Section title="Citations">
        <CitationsEditor
          citations={draft.citations}
          onChange={(citations) => {
            update({ ...draft, citations });
          }}
        />
      </Section>
      <Button
        color="error"
        startIcon={<Delete />}
        onClick={() => {
          setConfirming(true);
        }}
        sx={{ alignSelf: 'flex-start' }}
      >
        Delete annotation
      </Button>
      <ConfirmDelete
        open={confirming}
        title="Delete annotation?"
        description={`The highlight on “${truncate(record.anchor.quote.exact, 100)}” and its notes, links and citations will be deleted.`}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          onDelete(record);
        }}
      />
    </Stack>
  );
}

function AnnotationView({ record }: { record: AnnotationRecord }) {
  const empty =
    record.notes.trim() === '' && record.links.length === 0 && record.citations.length === 0;
  return (
    <Stack spacing={1.5}>
      {record.notes.trim() !== '' && <MarkdownView source={record.notes} />}
      {record.links.length > 0 && (
        <Section title="Links">
          <Stack component="ul" sx={{ pl: 2.5, my: 0 }}>
            {record.links.map((link, i) => (
              <li key={i}>
                <Link href={link.url} target="_blank" rel="noopener noreferrer" variant="body2">
                  {linkText(link)}
                </Link>
              </li>
            ))}
          </Stack>
        </Section>
      )}
      {record.citations.length > 0 && (
        <Section title="Citations">
          <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, my: 0 }}>
            {record.citations.map((citation, i) => (
              <Typography component="li" variant="body2" key={i}>
                <CitationView citation={citation} />
              </Typography>
            ))}
          </Stack>
        </Section>
      )}
      {empty && (
        <Typography variant="body2" color="text.secondary">
          A highlight without notes. Choose Edit to add some.
        </Typography>
      )}
    </Stack>
  );
}

export interface AnnotationEntryProps {
  record: AnnotationRecord;
  editing: boolean;
  focusNotes: boolean;
  onSave: (record: AnnotationRecord) => void;
  onDelete: (record: AnnotationRecord) => void;
}

/** An annotation in the panel: view mode, or its editor (ANN-030, ANN-031). */
export function AnnotationEntry({
  record,
  editing,
  focusNotes,
  onSave,
  onDelete,
}: AnnotationEntryProps) {
  return (
    <Box component="article" sx={{ py: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 14,
            height: 14,
            borderRadius: '3px',
            bgcolor: highlightVar(record.color),
            border: 1,
            borderColor: 'divider',
          }}
        />
        <Typography variant="overline" color="text.secondary">
          Annotation · {HIGHLIGHTS[record.color].name}
        </Typography>
      </Stack>
      <Typography variant="h6" component="h3" sx={{ fontStyle: 'italic', mb: 0.5 }}>
        “{truncate(record.anchor.quote.exact)}”
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
        {originLabel(record.origin)}
      </Typography>
      {editing ? (
        <AnnotationEditor
          record={record}
          focusNotes={focusNotes}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : (
        <AnnotationView record={record} />
      )}
    </Box>
  );
}
