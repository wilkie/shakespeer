import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getSource, type Variant, type VariantReading, type VersionInfo } from '@shakespeer/corpus';

import { MarkdownView } from '@/features/notes/MarkdownView';

/**
 * A variant in the notes panel (VAR-004): its title and note, where it comes from, and each
 * version's reading, the shown version's first.
 */
export function VariantEntry({
  variant,
  versionId,
  versions,
  onSource,
  onOpenReading,
}: {
  variant: Variant;
  versionId: string;
  versions: readonly VersionInfo[];
  onSource: (sourceId: string) => void;
  onOpenReading: (reading: VariantReading) => void;
}) {
  const order = (reading: VariantReading) =>
    reading.versionId === versionId ? -1 : versions.findIndex((v) => v.id === reading.versionId);
  const readings = [...variant.readings].sort((a, b) => order(a) - order(b));
  return (
    <Box>
      <Typography variant="subtitle2" component="h3">
        {variant.title}
      </Typography>
      {variant.note && <MarkdownView source={variant.note} />}
      <Stack component="dl" spacing={1} sx={{ my: 1 }}>
        {readings.map((reading) => {
          const version = versions.find((v) => v.id === reading.versionId);
          const name = version?.shortName ?? reading.versionId;
          return (
            <Box key={reading.versionId}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {version?.name ?? reading.versionId}
                {reading.versionId === versionId && ' (shown)'}
              </Typography>
              <Typography
                component="dd"
                sx={{
                  m: 0,
                  whiteSpace: 'pre-line',
                  fontFamily: '"EB Garamond Variable", "EB Garamond", Georgia, serif',
                  fontSize: '1.05rem',
                  color: reading.start ? 'text.primary' : 'text.secondary',
                  fontStyle: reading.start ? 'normal' : 'italic',
                }}
              >
                {reading.start ? reading.text : 'Not in this version'}
              </Typography>
              {reading.start && reading.versionId !== versionId && (
                <Button
                  size="small"
                  sx={{ px: 0, minWidth: 0 }}
                  onClick={() => {
                    onOpenReading(reading);
                  }}
                >
                  Open in {name}
                </Button>
              )}
            </Box>
          );
        })}
      </Stack>
      <Typography variant="caption" color="text.secondary" component="p">
        Source:{' '}
        {variant.sourceIds.map((sourceId, i) => (
          <span key={sourceId}>
            {i > 0 && ', '}
            <Link
              component="button"
              variant="caption"
              onClick={() => {
                onSource(sourceId);
              }}
            >
              {getSource(sourceId)?.shortName ?? sourceId}
            </Link>
          </span>
        ))}
      </Typography>
    </Box>
  );
}
