import Close from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TextAnchor, Variant, VariantReading, VersionInfo } from '@shakespeer/corpus';
import type { AnnotationRecord, DefinitionRecord } from '@shakespeer/storage';
import { useState, type ReactNode } from 'react';

import { AnnotationEntry } from '@/features/notes/AnnotationEntry';
import type { TermGroup } from '@/features/notes/noteIndex';
import { truncate } from '@/features/notes/format';
import { TermEntry } from '@/features/notes/TermEntry';
import { VariantEntry } from '@/features/variants/VariantEntry';

export interface PanelTerm {
  key: string;
  anchor: TextAnchor;
  group: TermGroup | undefined;
  drafts: DefinitionRecord[];
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface NotesPanelProps {
  terms: readonly PanelTerm[];
  annotations: readonly AnnotationRecord[];
  /** Variants at the activated point (VAR-004). */
  variants: readonly Variant[];
  /** The version shown, whose reading of a variant comes first. */
  versionId: string;
  versions: readonly VersionInfo[];
  editing: boolean;
  /** The field to focus when the panel opens in edit mode (SELX-006, SELX-007). */
  focusId: string | undefined;
  status: SaveStatus;
  variant: 'column' | 'sheet';
  onClose: () => void;
  onToggleEdit: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSource: (sourceId: string) => void;
  onAddDefinition: (term: PanelTerm) => void;
  onSaveDefinition: (record: DefinitionRecord) => void;
  onDeleteDefinition: (record: DefinitionRecord) => void;
  onSaveAnnotation: (record: AnnotationRecord) => void;
  onDeleteAnnotation: (record: AnnotationRecord) => void;
  /** Open in <version>: switches to another version at its reading (VAR-004). */
  onOpenReading: (reading: VariantReading) => void;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
};

function Header({
  editing,
  status,
  onClose,
  onToggleEdit,
  onCancel,
  onRetry,
}: Pick<
  NotesPanelProps,
  'editing' | 'status' | 'onClose' | 'onToggleEdit' | 'onCancel' | 'onRetry'
>) {
  return (
    <Box sx={{ px: 2, pt: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, flex: 1 }}>
          Notes
        </Typography>
        {editing && (
          <Button size="small" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          size="small"
          variant={editing ? 'contained' : 'outlined'}
          aria-pressed={editing}
          onClick={onToggleEdit}
        >
          {editing ? 'Done' : 'Edit'}
        </Button>
        <IconButton aria-label="Close notes" onClick={onClose} edge="end">
          <Close />
        </IconButton>
      </Stack>
      {/* PNL-027: saving state, with a retry if storage failed. */}
      <Typography
        variant="caption"
        color={status === 'error' ? 'error' : 'text.secondary'}
        role="status"
        sx={{ minHeight: 20, display: 'block' }}
      >
        {STATUS_TEXT[status]}
        {status === 'error' && (
          <Button size="small" color="error" onClick={onRetry} sx={{ ml: 1, py: 0 }}>
            Retry
          </Button>
        )}
      </Typography>
    </Box>
  );
}

function Body(props: NotesPanelProps) {
  const { terms, annotations, variants, editing, focusId } = props;
  const entries: { key: string; label: string; content: ReactNode }[] = [
    ...terms.map((term) => ({
      key: `t:${term.key}`,
      label: `Definition: “${truncate(term.anchor.quote.exact, 40)}”`,
      content: (
        <TermEntry
          anchor={term.anchor}
          group={term.group}
          drafts={term.drafts}
          editing={editing}
          focusId={focusId}
          onAddDefinition={() => {
            props.onAddDefinition(term);
          }}
          onSave={props.onSaveDefinition}
          onDelete={props.onDeleteDefinition}
          onSource={props.onSource}
        />
      ),
    })),
    ...annotations.map((record) => ({
      key: `a:${record.id}`,
      label: `Annotation: “${truncate(record.anchor.quote.exact, 40)}”`,
      content: (
        <AnnotationEntry
          record={record}
          editing={editing}
          focusNotes={record.id === focusId}
          onSave={props.onSaveAnnotation}
          onDelete={props.onDeleteAnnotation}
        />
      ),
    })),
    ...variants.map((variant) => ({
      key: `v:${variant.id}`,
      label: `Variant: ${truncate(variant.title, 50)}`,
      content: (
        <VariantEntry
          variant={variant}
          versionId={props.versionId}
          versions={props.versions}
          onSource={props.onSource}
          onOpenReading={props.onOpenReading}
        />
      ),
    })),
  ];

  if (entries.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>
        Nothing here any more.
      </Typography>
    );
  }
  if (entries.length === 1) {
    return <Box sx={{ px: 2, pb: 2 }}>{entries[0]?.content}</Box>;
  }
  // Several notes are collapsible, all expanded when there are at most three (PNL-012).
  return (
    <Box sx={{ px: 1, pb: 2 }}>
      {entries.map((entry) => (
        <Accordion
          key={entry.key}
          defaultExpanded={entries.length <= 3}
          disableGutters
          elevation={0}
          sx={{ '&::before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="body2">{entry.label}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>{entry.content}</AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

/**
 * The notes panel (PNL): a column at the left on wide screens (PNL-002), a bottom sheet that can
 * be dragged taller or dismissed on phones (PNL-003).
 */
export function NotesPanel(props: NotesPanelProps) {
  const { variant, onClose } = props;
  const [sheetHeight, setSheetHeight] = useState(50); // percent of viewport height
  const [drag, setDrag] = useState<{ startY: number; startHeight: number } | null>(null);
  const header = <Header {...props} />;

  if (variant === 'column') {
    return (
      <Box
        component="aside"
        aria-label="Notes"
        sx={{
          width: 380,
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
        {header}
        <Body {...props} />
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
        height: `${String(props.editing ? Math.max(sheetHeight, 70) : sheetHeight)}dvh`,
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
      {header}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        <Body {...props} />
      </Box>
    </Box>
  );
}
