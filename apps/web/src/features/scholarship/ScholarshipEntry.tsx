import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  SCHOLARSHIP_SOURCE_ID,
  workUrl,
  type ScholarshipFile,
  type ScholarshipWork,
} from '@shakespeer/corpus';
import type { Citation } from '@shakespeer/storage';
import { useState } from 'react';

import {
  LIVE_LINE_LIMIT,
  LookupError,
  authorList,
  liveLookup,
  snapshotItems,
  typeLabel,
  workCitation,
  type ChosenLine,
  type LookupLine,
  type ScholarshipItem,
} from './scholarship';

/** Works shown before Show all (SCH-021). */
const FIRST = 20;

const ERRORS: Record<LookupError['kind'], string> = {
  offline: 'You seem to be offline, so OpenAlex could not be searched.',
  limit:
    'OpenAlex’s daily limit has been reached. It is shared by everyone on the same network and resets at midnight UTC.',
  error: 'OpenAlex could not be searched just now.',
};

type CiteState = 'saving' | 'added' | 'created' | 'failed';

function WorkItem({
  item,
  showLines,
  cite,
  onCite,
}: {
  item: ScholarshipItem;
  showLines: boolean;
  cite: CiteState | undefined;
  onCite: () => void;
}) {
  const { work } = item;
  const details = [
    authorList(work.authors),
    work.year ? String(work.year) : '',
    work.venue ?? '',
    typeLabel(work.type),
  ].filter(Boolean);
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Link href={workUrl(work)} target="_blank" rel="noopener noreferrer">
        {work.title || 'Untitled'}
      </Link>
      <Typography variant="body2" color="text.secondary">
        {details.join(' · ')}
      </Typography>
      {showLines && (
        <Typography variant="caption" color="text.secondary" component="p">
          Quotes {item.lines.length === 1 ? 'line' : 'lines'}{' '}
          {item.lines.map((l) => l.n || l.id).join(', ')}
        </Typography>
      )}
      {cite === 'added' || cite === 'created' ? (
        <Typography variant="caption" color="success.main" component="p" role="status">
          {cite === 'added' ? 'Added to a note on this line' : 'Added to a new note on this line'}
        </Typography>
      ) : (
        <Button
          size="small"
          sx={{ px: 0, minWidth: 0 }}
          disabled={cite === 'saving'}
          onClick={onCite}
        >
          {cite === 'failed' ? 'Could not save; try again' : 'Cite in a note'}
        </Button>
      )}
    </Box>
  );
}

function WorkList({
  items,
  showLines,
  cites,
  onCite,
}: {
  items: readonly ScholarshipItem[];
  showLines: boolean;
  cites: ReadonlyMap<string, CiteState>;
  onCite: (item: ScholarshipItem) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, FIRST);
  return (
    <>
      <Stack component="ul" spacing={1.5} sx={{ pl: 0, my: 1 }}>
        {shown.map((item) => (
          <WorkItem
            key={item.work.id}
            item={item}
            showLines={showLines}
            cite={cites.get(item.work.id)}
            onCite={() => {
              onCite(item);
            }}
          />
        ))}
      </Stack>
      {items.length > shown.length && (
        <Button
          size="small"
          onClick={() => {
            setAll(true);
          }}
        >
          Show all {items.length}
        </Button>
      )}
    </>
  );
}

export interface ScholarshipEntryProps {
  /** The chosen lines of the version shown. */
  lines: readonly ChosenLine[];
  /** The version's snapshot, if it has one and scholarship is switched on (SCH-023). */
  snapshot: ScholarshipFile | undefined;
  /** Whether the snapshot is there but switched off (SCH-023). */
  switchedOff?: boolean;
  /** Works the snapshot dropped as reprints, dropped from live results too (SCH-030). */
  reprints: readonly string[];
  /** The chosen lines with the phrases to look up, through alignment for an original version. */
  lookupLines: () => Promise<LookupLine[]>;
  onSource: (sourceId: string) => void;
  onCite: (lineId: string, citation: Citation) => Promise<'added' | 'created'>;
}

/**
 * Scholarship in the notes panel (SCH-020 – SCH-033): the snapshot's works quoting the chosen
 * lines, where they come from, and a live search of OpenAlex.
 */
export function ScholarshipEntry({
  lines,
  snapshot,
  switchedOff,
  reprints,
  lookupLines,
  onSource,
  onCite,
}: ScholarshipEntryProps) {
  const items = snapshotItems(snapshot, lines);
  const [live, setLive] = useState<
    | { state: 'idle' }
    | { state: 'searching' }
    | { state: 'done'; items: ScholarshipItem[] }
    | { state: 'failed'; kind: LookupError['kind'] }
  >({ state: 'idle' });
  const [cites, setCites] = useState<ReadonlyMap<string, CiteState>>(new Map());

  const range =
    lines.length === 1
      ? `Line ${lines[0]?.n ?? ''}`
      : `Lines ${lines[0]?.n ?? ''}–${lines.at(-1)?.n ?? ''}`;

  const search = () => {
    setLive({ state: 'searching' });
    const shown: ScholarshipWork[] = items.map((item) => item.work);
    void lookupLines()
      .then((lookup) => liveLookup(lookup, { reprints: new Set(reprints), shown }))
      .then((found) => {
        setLive({ state: 'done', items: found });
      })
      .catch((error: unknown) => {
        setLive({ state: 'failed', kind: error instanceof LookupError ? error.kind : 'error' });
      });
  };

  const cite = (item: ScholarshipItem) => {
    const line = item.lines[0];
    if (!line) {
      return;
    }
    const set = (state: CiteState) => {
      setCites((current) => new Map(current).set(item.work.id, state));
    };
    set('saving');
    void onCite(line.id, workCitation(item.work)).then(set, () => {
      set('failed');
    });
  };

  return (
    <Box>
      <Typography variant="subtitle2" component="h3">
        {range}
      </Typography>
      {snapshot ? (
        items.length > 0 ? (
          <WorkList items={items} showLines={lines.length > 1} cites={cites} onCite={cite} />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            No works quoting {lines.length === 1 ? 'this line' : 'these lines'} were found when the
            play was looked up.
          </Typography>
        )
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
          {switchedOff === true
            ? 'Scholarship is switched off; search OpenAlex to look these lines up.'
            : 'Scholarship has not been gathered for this text; search OpenAlex to look it up.'}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" component="p">
        {snapshot && <>From OpenAlex, retrieved {snapshot.retrievedAt}. </>}
        Only works whose full text OpenAlex holds can be found, mostly open-access work.{' '}
        <Link
          component="button"
          variant="caption"
          onClick={() => {
            onSource(SCHOLARSHIP_SOURCE_ID);
          }}
        >
          About OpenAlex
        </Link>
      </Typography>

      <Box sx={{ mt: 2 }}>
        {live.state === 'done' ? (
          <>
            <Typography variant="subtitle2" component="h4">
              New from OpenAlex
            </Typography>
            {live.items.length > 0 ? (
              <WorkList
                items={live.items}
                showLines={lines.length > 1}
                cites={cites}
                onCite={cite}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                OpenAlex found nothing new.
              </Typography>
            )}
          </>
        ) : live.state === 'failed' ? null : (
          <Button
            variant="outlined"
            size="small"
            onClick={search}
            disabled={live.state === 'searching'}
            startIcon={live.state === 'searching' ? <CircularProgress size={14} /> : undefined}
          >
            {live.state === 'searching' ? 'Searching OpenAlex…' : 'Search OpenAlex now'}
          </Button>
        )}
        {live.state === 'failed' && (
          <Typography variant="body2" color="error" role="alert" sx={{ mt: 1 }}>
            {ERRORS[live.kind]}{' '}
            <Button size="small" color="error" onClick={search}>
              Try again
            </Button>
          </Typography>
        )}
        {lines.length > LIVE_LINE_LIMIT && live.state !== 'done' && (
          <Typography variant="caption" color="text.secondary" component="p">
            Only the first {LIVE_LINE_LIMIT} lines are looked up.
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          Searching sends these lines’ words to OpenAlex, and nothing about you.
        </Typography>
      </Box>
    </Box>
  );
}
