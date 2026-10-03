import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { getSource } from '@shakespeer/corpus';

/** A source's description, license and required attribution (ATR-001). */
export function SourceDetails({ sourceId }: { sourceId: string }) {
  const source = getSource(sourceId);
  if (!source) {
    return null;
  }
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
        <Link href={source.url} target="_blank" rel="noopener noreferrer">
          {source.name}
        </Link>
      </Typography>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {source.description}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        License:{' '}
        <Link href={source.license.url} target="_blank" rel="noopener noreferrer">
          {source.license.name}
        </Link>
        . {source.attribution}
      </Typography>
    </Box>
  );
}

export interface SourceDialogProps {
  title: string;
  sourceIds: readonly string[];
  open: boolean;
  onClose: () => void;
}

/** "About this text" (ATR-003) and a definition's source (ATR-010). */
export function SourceDialog({ title, sourceIds, open, onClose }: SourceDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {sourceIds.map((id) => (
          <SourceDetails key={id} sourceId={id} />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/** The "About this text" section at the end of a version (ATR-002). */
export function AboutThisText({ sourceIds }: { sourceIds: readonly string[] }) {
  return (
    <Box
      component="footer"
      sx={{ mt: 8, pt: 3, borderTop: 1, borderColor: 'divider', fontFamily: 'body1.fontFamily' }}
    >
      <Typography variant="h6" component="h2" gutterBottom>
        About this text
      </Typography>
      {sourceIds.map((id) => (
        <SourceDetails key={id} sourceId={id} />
      ))}
    </Box>
  );
}
