/**
 * Writes generated definitions for a play's modern version (GEN-010). Run by hand, never by
 * ingest (CRP-006); needs an Anthropic API key in the environment (ANTHROPIC_API_KEY).
 *
 *   pnpm --filter @shakespeer/corpus generate-definitions --play <playId>
 *       [--model <id>] [--words <n>] [--concurrency <n>] [--dry-run] [--sample]
 *
 * --words      ask about only the first n words still without an answer (a trial run)
 * --dry-run    list the candidates and print the first request, without calling the API
 * --sample     list the review sample (GEN-021) and its statuses, without calling the API
 *
 * The results go to `curation/<playId>/generated/<versionId>.json`; run ingest afterwards.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import type { SourcedDefinitionsFile, VersionDocument } from '../src/schema.ts';
import { GLOSSARIES, PLAYS } from './config.ts';
import { scowlWords, selectCandidates, speechLines } from './generated/candidates.ts';
import {
  formatGeneratedFile,
  generatedFilePath,
  loadGeneratedFile,
  partitionEntries,
  reviewSample,
} from './generated/file.ts';
import { generateDefinitions, type AskModel } from './generated/generate.ts';
import {
  ResponseSchema,
  SYSTEM_PROMPT,
  batches,
  contextIndex,
  requestText,
} from './generated/prompt.ts';
import { fetchLocked, type LockFile } from './lib/fetch.ts';

const ROOT = dirname(import.meta.dirname);
const SCOWL = 'scowl-2020.12.07';

/** Listings asked for (--dry-run, --sample) go to standard output; progress to standard error. */
const print = (text: string) => process.stdout.write(`${text}\n`);

const { values: args } = parseArgs({
  options: {
    play: { type: 'string' },
    model: { type: 'string', default: 'claude-opus-5-5' },
    words: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
    'dry-run': { type: 'boolean', default: false },
    sample: { type: 'boolean', default: false },
  },
});

const play = PLAYS.find((p) => p.info.id === args.play);
if (!play) {
  throw new Error(
    `--play must be one of: ${PLAYS.map((p) => p.info.id).join(', ')} (got ${args.play ?? 'nothing'})`,
  );
}
const playId = play.info.id;
const versionId = play.info.modernVersionId;
const readJson = async <T>(path: string) => JSON.parse(await readFile(path, 'utf8')) as T;
const doc = await readJson<VersionDocument>(join(ROOT, 'plays', playId, `${versionId}.json`));
const path = generatedFilePath(ROOT, playId, versionId);
const existing = await loadGeneratedFile(path);

if (args.sample) {
  if (!existing) {
    throw new Error(`No generated definitions yet at ${path}`);
  }
  const { valid } = partitionEntries(doc, existing);
  const lines = new Map(speechLines(doc).flatMap((scene) => scene.map((l) => [l.nodeId, l])));
  print(`Review sample for ${play.info.title}: mark each entry "reviewed" or "rejected".\n`);
  for (const entry of reviewSample(valid)) {
    const line = lines.get(entry.nodeId);
    print(
      `[${entry.status}] ${entry.nodeId}:${String(entry.start)} ${line?.scene ?? ''}\n` +
        `  ${line?.text ?? ''}\n  ${entry.word}: ${entry.partOfSpeech ? `(${entry.partOfSpeech}) ` : ''}${entry.meaning}\n`,
    );
  }
  process.exit(0);
}

// Every sourced definition of the version, to leave alone what the glossaries define (GEN-002).
const sourced = await Promise.all(
  GLOSSARIES.filter((g) => g.playAbbreviations[playId]).map((g) =>
    readJson<SourcedDefinitionsFile>(
      join(ROOT, 'plays', playId, 'definitions', versionId, `${g.sourceId}.json`),
    ),
  ),
);
const lock = await readJson<LockFile>(join(import.meta.dirname, 'sources.lock.json'));
const scowl = lock.files[SCOWL];
if (!scowl) {
  throw new Error(`No ${SCOWL} in sources.lock.json`);
}
const common = scowlWords(
  await fetchLocked(SCOWL, scowl, {
    cacheDir: join(ROOT, '.cache'),
    rootDir: ROOT,
    updateLock: false,
  }),
);
const candidates = selectCandidates(doc, sourced, common);
const occurrences = candidates.reduce((n, c) => n + c.occurrences.length, 0);
console.warn(
  `${play.info.title}: ${String(candidates.length)} candidate words, ${String(occurrences)} occurrences`,
);

if (args['dry-run']) {
  print(candidates.map((c) => `${c.word} (${String(c.occurrences.length)})`).join(', '));
  const first = candidates[0];
  const batch = first ? batches(first)[0] : undefined;
  if (first && batch) {
    print(`\n--- system ---\n${SYSTEM_PROMPT}\n\n--- first request ---`);
    print(requestText(play.info.title, first.word, batch, contextIndex(speechLines(doc))));
  }
  process.exit(0);
}

const client = new Anthropic();
const model = args.model;
const ask: AskModel = async (system, text) => {
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: zodOutputFormat(ResponseSchema) },
      system,
      messages: [{ role: 'user', content: text }],
    });
    if (response.stop_reason !== 'end_turn') {
      console.warn(`  stopped: ${response.stop_reason ?? 'unknown'}`);
      return undefined;
    }
    return response.parsed_output ?? undefined;
  } catch (error) {
    // Rate limits, overload and lost connections are retried by the SDK, then left for the
    // next run; anything else (a bad key, a bad request) stops the run.
    if (
      error instanceof Anthropic.RateLimitError ||
      error instanceof Anthropic.InternalServerError ||
      error instanceof Anthropic.APIConnectionError
    ) {
      console.warn(`  request failed: ${error.message}`);
      return undefined;
    }
    throw error;
  }
};

const result = await generateDefinitions({
  doc,
  playTitle: play.info.title,
  candidates,
  existing,
  model,
  ask,
  save: async (file) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, formatGeneratedFile(file));
  },
  today: new Date().toISOString().slice(0, 10),
  concurrency: Number(args.concurrency),
  ...(args.words ? { maxWords: Number(args.words) } : {}),
  log: (message) => {
    console.warn(message);
  },
});
console.warn(
  `${String(result.added)} definitions added, ${String(result.notNeeded)} occurrences need none, ` +
    `${String(result.failed)} requests without an answer (asked again next run). Written to ${path}`,
);
