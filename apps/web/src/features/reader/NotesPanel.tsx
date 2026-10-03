import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getSource, type SourcedDefinition } from '@shakespeer/corpus';
import { useState, type ReactNode } from 'react';

import type { TermEntry } from './terms';

const PART_OF_SPEECH_LABELS: Record<NonNullable<SourcedDefinition['partOfSpeech']>, string> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adj.',
  adverb: 'adv.',
  pronoun: 'pron.',
  preposition: 'prep.',
  conjunction: 'conj.',
  interjection: 'interj.',
  phrase: 'phrase',
  other: '',
};

function truncate(text: string, length = 80): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/** One term and its definitions, grouped by source (DEF-031, PNL-011, ATR-010). */
function TermView({
  entries,
  onSource,
}: {
  entries: readonly TermEntry[];
  onSource: (sourceId: string) => void;
}) {
  const quote = entries[0]?.term.anchor.quote.exact ?? '';
  return (
    <Box component="article" sx={{ py: 2 }}>
      <Typography variant="overline" color="text.secondary">
        Definition
      </Typography>
      <Typography variant="h6" component="h3" sx={{ fontStyle: 'italic', mb: 1 }}>
        “{truncate(quote)}”
      </Typography>
      {entries.map(({ term, sourceId }) => {
        const source = getSource(sourceId);
        return (
          <Box key={term.id} sx={{ mb: 1.5 }}>
            <Stack component="ol" spacing={1} sx={{ pl: 2.5, my: 0 }}>
              {term.definitions.map((definition, i) => (
                <Typography component="li" key={i}>
                  {definition.partOfSpeech && PART_OF_SPEECH_LABELS[definition.partOfSpeech] && (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ fontStyle: 'italic', mr: 0.75 }}
                    >
                      {PART_OF_SPEECH_LABELS[definition.partOfSpeech]}
                    </Typography>
                  )}
                  {definition.meaning}
                </Typography>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
              {term.headword !== quote && <>Headword “{term.headword}”. </>}
              Source:{' '}
              <Link
                component="button"
                variant="caption"
                onClick={() => {
                  onSource(sourceId);
                }}
              >
                {source?.shortName ?? sourceId}
              </Link>
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export interface NotesPanelContent {
  /** Terms covering the activated point (PNL-010), grouped by anchor. */
  terms: (readonly TermEntry[])[];
}

export interface NotesPanelProps {
  content: NotesPanelContent;
  variant: 'column' | 'sheet';
  onClose: () => void;
  onSource: (sourceId: string) => void;
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1 }}
    >
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
        Notes
      </Typography>
      <IconButton aria-label="Close notes" onClick={onClose} edge="end">
        <Close />
      </IconButton>
    </Stack>
  );
}

function Body({ content, onSource }: Pick<NotesPanelProps, 'content' | 'onSource'>) {
  const items: ReactNode[] = content.terms.map((entries, i) => (
    <Box key={entries[0]?.term.id ?? i}>
      {i > 0 && <Divider />}
      <TermView entries={entries} onSource={onSource} />
    </Box>
  ));
  return <Box sx={{ px: 2, pb: 2 }}>{items}</Box>;
}

/**
 * The notes panel (PNL): a column at the left on wide screens (PNL-002), a bottom sheet that
 * can be dragged taller or dismissed on phones (PNL-003).
 */
export function NotesPanel({ content, variant, onClose, onSource }: NotesPanelProps) {
  const [sheetHeight, setSheetHeight] = useState(50); // percent of viewport height
  const [drag, setDrag] = useState<{ startY: number; startHeight: number } | null>(null);

  if (variant === 'column') {
    return (
      <Box
        component="aside"
        aria-label="Notes"
        sx={{
          width: 360,
          flexShrink: 0,
          position: 'sticky',
          top: 'var(--reader-top, 64px)',
          height: 'calc(100dvh - var(--reader-top, 64px))',
          overflowY: 'auto',
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Header onClose={onClose} />
        <Body content={content} onSource={onSource} />
      </Box>
    );
  }

  return (
    <Box
      component="aside"
      aria-label="Notes"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: `${String(sheetHeight)}dvh`,
        zIndex: (theme) => theme.zIndex.drawer,
        bgcolor: 'background.paper',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: 8,
        display: 'flex',
        flexDirection: 'column',
        transition: drag ? 'none' : 'height 150ms ease-out',
      }}
    >
      <Box
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize notes"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ startY: event.clientY, startHeight: sheetHeight });
        }}
        onPointerMove={(event) => {
          if (drag) {
            const delta = ((drag.startY - event.clientY) / window.innerHeight) * 100;
            setSheetHeight(Math.min(92, Math.max(10, drag.startHeight + delta)));
          }
        }}
        onPointerUp={() => {
          setDrag(null);
          if (sheetHeight < 25) {
            onClose();
            setSheetHeight(50);
          } else if (sheetHeight > 70) {
            setSheetHeight(92);
          }
        }}
        sx={{
          py: 1,
          cursor: 'grab',
          touchAction: 'none',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'text.disabled' }} />
      </Box>
      <Header onClose={onClose} />
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        <Body content={content} onSource={onSource} />
      </Box>
    </Box>
  );
}
