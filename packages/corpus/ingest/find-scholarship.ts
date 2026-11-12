/**
 * Gathers a play's scholarship snapshot from OpenAlex (SCH-010). Run by hand, never by ingest
 * (CRP-006); needs an OpenAlex API key in the environment (OPENALEX_API_KEY).
 *
 *   pnpm --filter @shakespeer/corpus find-scholarship --play <playId> [--from <n> --to <n>]
 *
 * --from, --to   only lines in this range of line numbers, e.g. --from 1.2.1 --to 1.2.200
 *
 * The results go to `curation/<playId>/scholarship/<versionId>.json`; run ingest afterwards.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { parseWork, worksQueryUrl, type FoundWork } from '../src/scholarship.ts';
import type { VersionDocument } from '../src/schema.ts';
import { PLAYS } from './config.ts';
import {
  formatScholarshipCuration,
  loadScholarshipCuration,
  scholarshipFilePath,
} from './scholarship/file.ts';
import { gatherScholarship } from './scholarship/gather.ts';

const ROOT = dirname(import.meta.dirname);

const { values: args } = parseArgs({
  options: {
    play: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
  },
});

const play = PLAYS.find((p) => p.info.id === args.play);
if (!play) {
  throw new Error(
    `--play must be one of: ${PLAYS.map((p) => p.info.id).join(', ')} (got ${args.play ?? 'nothing'})`,
  );
}
const apiKey = process.env['OPENALEX_API_KEY'];
if (!apiKey) {
  throw new Error('Set OPENALEX_API_KEY to an OpenAlex API key (free from openalex.org).');
}
const playId = play.info.id;
const versionId = play.info.modernVersionId;
const doc = JSON.parse(
  await readFile(join(ROOT, 'plays', playId, `${versionId}.json`), 'utf8'),
) as VersionDocument;
const path = scholarshipFilePath(ROOT, playId, versionId);

/** Compares line numbers such as "1.2.10" part by part. */
const compare = (a: string, b: string) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};
const from = args.from;
const to = args.to;
const include = (n: string) =>
  n !== '' && (!from || compare(n, from) >= 0) && (!to || compare(n, to) <= 0);

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** One lookup, retried on dropped connections and refusals; undefined if they persist. */
const findWorks = async (phrase: string): Promise<FoundWork[] | undefined> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(worksQueryUrl(phrase, apiKey));
      if (response.ok) {
        const body = (await response.json()) as { results?: unknown[] };
        await sleep(100);
        return (body.results ?? []).map(parseWork);
      }
      if (response.status === 429) {
        console.warn('  OpenAlex rate limit; waiting');
      }
    } catch {
      // A dropped connection: try again.
    }
    await sleep(1000 * 2 ** attempt);
  }
  return undefined;
};

const result = await gatherScholarship({
  doc,
  existing: await loadScholarshipCuration(path),
  findWorks,
  save: async (file) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, formatScholarshipCuration(file));
  },
  today: new Date().toISOString().slice(0, 10),
  include,
  log: (message) => {
    console.warn(message);
  },
});
console.warn(
  `${String(result.asked)} lines looked up, ${String(result.failed)} without an answer ` +
    `(asked again next run). Written to ${path}`,
);
