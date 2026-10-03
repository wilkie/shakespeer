import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { Link } from '@shakespeer/storage';

import { isSafeUrl, linkText } from './links';

export function LinksEditor({
  links,
  onChange,
}: {
  links: readonly Link[];
  onChange: (links: Link[]) => void;
}) {
  const update = (index: number, patch: Partial<Link>) => {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  };
  return (
    <Stack spacing={1}>
      {links.map((link, i) => {
        const invalid = link.url !== '' && !isSafeUrl(link.url);
        return (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField
              size="small"
              label="URL"
              value={link.url}
              error={invalid}
              helperText={invalid ? 'Use an http or https address' : undefined}
              onChange={(event) => {
                update(i, { url: event.target.value.trim() });
              }}
              sx={{ flex: 2 }}
            />
            <TextField
              size="small"
              label="Label (optional)"
              value={link.label ?? ''}
              onChange={(event) => {
                const label = event.target.value;
                update(i, label ? { label } : { label: undefined });
              }}
              sx={{ flex: 1 }}
            />
            <IconButton
              aria-label={`Remove link ${linkText(link) || String(i + 1)}`}
              onClick={() => {
                onChange(links.filter((_, j) => j !== i));
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        );
      })}
      <Button
        size="small"
        startIcon={<Add />}
        onClick={() => {
          onChange([...links, { url: '' }]);
        }}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add link
      </Button>
    </Stack>
  );
}
