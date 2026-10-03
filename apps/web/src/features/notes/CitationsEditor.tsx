import Add from '@mui/icons-material/Add';
import ContentPaste from '@mui/icons-material/ContentPaste';
import Delete from '@mui/icons-material/DeleteOutlined';
import Edit from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Citation } from '@shakespeer/storage';
import { useState } from 'react';

import { formatCitation, parseCitationText, parseName } from './citations';

const TYPES: { value: Citation['type']; label: string }[] = [
  { value: 'book', label: 'Book' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'article-journal', label: 'Article' },
  { value: 'webpage', label: 'Web page' },
  { value: 'document', label: 'Other' },
];

/** A citation as display text, linked to its DOI or URL (ANN-006). */
export function CitationView({ citation }: { citation: Citation }) {
  const { text, href } = formatCitation(citation);
  return href ? (
    <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
      {text}
    </Link>
  ) : (
    <>{text}</>
  );
}

interface FormState {
  type: Citation['type'];
  title: string;
  authors: string;
  year: string;
  container: string;
  publisher: string;
  place: string;
  volume: string;
  issue: string;
  page: string;
  url: string;
  doi: string;
  note: string;
}

function toForm(citation: Citation | undefined): FormState {
  return {
    type: citation?.type ?? 'book',
    title: citation?.title ?? '',
    authors: (citation?.author ?? [])
      .map((name) =>
        'literal' in name
          ? name.literal
          : name.given
            ? `${name.family}, ${name.given}`
            : name.family,
      )
      .join('; '),
    year: String(citation?.issued?.['date-parts'][0]?.[0] ?? ''),
    container: citation?.['container-title'] ?? '',
    publisher: citation?.publisher ?? '',
    place: citation?.['publisher-place'] ?? '',
    volume: citation?.volume ?? '',
    issue: citation?.issue ?? '',
    page: citation?.page ?? '',
    url: citation?.URL ?? '',
    doi: citation?.DOI ?? '',
    note: citation?.note ?? '',
  };
}

function fromForm(form: FormState): Citation {
  const year = Number(form.year);
  const authors = form.authors
    .split(';')
    .map((name) => name.trim())
    .filter(Boolean)
    .map(parseName);
  const entries = {
    type: form.type,
    title: form.title.trim(),
    author: authors.length > 0 ? authors : undefined,
    issued: year ? { 'date-parts': [[year]] as [number][] } : undefined,
    'container-title': form.container.trim() || undefined,
    publisher: form.publisher.trim() || undefined,
    'publisher-place': form.place.trim() || undefined,
    volume: form.volume.trim() || undefined,
    issue: form.issue.trim() || undefined,
    page: form.page.trim() || undefined,
    URL: form.url.trim() || undefined,
    DOI: form.doi.trim() || undefined,
    note: form.note.trim() || undefined,
  };
  return Object.fromEntries(
    Object.entries(entries).filter(([, v]) => v !== undefined),
  ) as unknown as Citation;
}

/** Structured citation fields (ANN-004). Only the title is required. */
function CitationForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Citation | undefined;
  onSave: (citation: Citation) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => toForm(initial));
  const field = (
    key: keyof FormState,
    label: string,
    props: { multiline?: boolean; sx?: object } = {},
  ) => (
    <TextField
      size="small"
      label={label}
      value={form[key]}
      onChange={(event) => {
        setForm({ ...form, [key]: event.target.value });
      }}
      {...props}
    />
  );
  return (
    <Stack spacing={1} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <TextField
        select
        size="small"
        label="Type"
        value={form.type}
        onChange={(event) => {
          setForm({ ...form, type: event.target.value as Citation['type'] });
        }}
      >
        {TYPES.map((type) => (
          <MenuItem key={type.value} value={type.value}>
            {type.label}
          </MenuItem>
        ))}
      </TextField>
      {field('title', 'Title (required)')}
      {field('authors', 'Authors (Family, Given; …)')}
      <Stack direction="row" spacing={1}>
        {field('year', 'Year', { sx: { width: 90 } })}
        {field('container', form.type === 'chapter' ? 'Book title' : 'Journal or site', {
          sx: { flex: 1 },
        })}
      </Stack>
      <Stack direction="row" spacing={1}>
        {field('publisher', 'Publisher', { sx: { flex: 1 } })}
        {field('place', 'Place', { sx: { flex: 1 } })}
      </Stack>
      <Stack direction="row" spacing={1}>
        {field('volume', 'Volume', { sx: { flex: 1 } })}
        {field('issue', 'Issue', { sx: { flex: 1 } })}
        {field('page', 'Pages', { sx: { flex: 1 } })}
      </Stack>
      {field('url', 'URL')}
      {field('doi', 'DOI')}
      {field('note', 'Note', { multiline: true })}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={form.title.trim() === ''}
          onClick={() => {
            onSave(fromForm(form));
          }}
        >
          {initial ? 'Update citation' : 'Add citation'}
        </Button>
      </Stack>
    </Stack>
  );
}

/** Pasting BibTeX, RIS or CSL-JSON from a library or reference manager (ANN-005). */
function PasteCitations({
  onAdd,
  onCancel,
}: {
  onAdd: (citations: Citation[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  return (
    <Stack spacing={1}>
      <TextField
        multiline
        minRows={4}
        size="small"
        label="Paste BibTeX or RIS"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(false);
        }}
        slotProps={{
          htmlInput: { spellCheck: false, style: { fontFamily: 'monospace', fontSize: '0.8rem' } },
        }}
      />
      {error && (
        <Alert severity="warning">
          {'No citations found. Paste BibTeX (@book{…}) or RIS (TY  - …).'}
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={text.trim() === ''}
          onClick={() => {
            const citations = parseCitationText(text);
            if (citations.length === 0) {
              setError(true);
            } else {
              onAdd(citations);
            }
          }}
        >
          Add citations
        </Button>
      </Stack>
    </Stack>
  );
}

export function CitationsEditor({
  citations,
  onChange,
}: {
  citations: readonly Citation[];
  onChange: (citations: Citation[]) => void;
}) {
  const [mode, setMode] = useState<
    { kind: 'none' } | { kind: 'form'; index: number | undefined } | { kind: 'paste' }
  >({
    kind: 'none',
  });
  return (
    <Stack spacing={1}>
      {citations.map((citation, i) =>
        mode.kind === 'form' && mode.index === i ? (
          <CitationForm
            key={i}
            initial={citation}
            onSave={(updated) => {
              onChange(citations.map((c, j) => (j === i ? updated : c)));
              setMode({ kind: 'none' });
            }}
            onCancel={() => {
              setMode({ kind: 'none' });
            }}
          />
        ) : (
          <Stack key={i} direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <Typography variant="body2" sx={{ flex: 1, pt: 0.5 }}>
              <CitationView citation={citation} />
            </Typography>
            <IconButton
              size="small"
              aria-label={`Edit citation ${citation.title}`}
              onClick={() => {
                setMode({ kind: 'form', index: i });
              }}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Remove citation ${citation.title}`}
              onClick={() => {
                onChange(citations.filter((_, j) => j !== i));
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
        ),
      )}
      {mode.kind === 'form' && mode.index === undefined && (
        <CitationForm
          initial={undefined}
          onSave={(citation) => {
            onChange([...citations, citation]);
            setMode({ kind: 'none' });
          }}
          onCancel={() => {
            setMode({ kind: 'none' });
          }}
        />
      )}
      {mode.kind === 'paste' && (
        <PasteCitations
          onAdd={(added) => {
            onChange([...citations, ...added]);
            setMode({ kind: 'none' });
          }}
          onCancel={() => {
            setMode({ kind: 'none' });
          }}
        />
      )}
      {mode.kind === 'none' && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => {
              setMode({ kind: 'form', index: undefined });
            }}
          >
            Add citation
          </Button>
          <Button
            size="small"
            startIcon={<ContentPaste />}
            onClick={() => {
              setMode({ kind: 'paste' });
            }}
          >
            Paste BibTeX/RIS
          </Button>
        </Box>
      )}
    </Stack>
  );
}
