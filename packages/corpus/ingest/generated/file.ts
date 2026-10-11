/**
 * The curation file of generated definitions (GEN-013), the checks ingest applies to it
 * (GEN-020), its review sample (GEN-021) and its counts (GEN-022).
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import {
  GENERATED_SOURCE_ID,
  PartOfSpeechSchema,
  type SourcedTerm,
  type TextNode,
  type VersionDocument,
} from '../../src/schema.ts';
import { anchorFor } from '../glossaries/match.ts';
import { textNodes } from '../lib/revision.ts';

export { GENERATED_SOURCE_ID };

const OccurrenceSchema = z.object({
  nodeId: z.string().min(1),
  start: z.int().nonnegative(),
  end: z.int().nonnegative(),
  word: z.string().min(1),
});

export const GeneratedEntrySchema = OccurrenceSchema.extend({
  meaning: z.string(),
  partOfSpeech: PartOfSpeechSchema.optional(),
  status: z.enum(['auto', 'reviewed', 'rejected']),
});
export type GeneratedEntry = z.infer<typeof GeneratedEntrySchema>;

export const GeneratedFileSchema = z.object({
  model: z.string().min(1),
  /** The date of the last run, YYYY-MM-DD. */
  generatedAt: z.iso.date(),
  promptVersion: z.int().positive(),
  entries: z.array(GeneratedEntrySchema),
  /** Occurrences the model said need no definition (GEN-013). */
  notNeeded: z.array(OccurrenceSchema),
});
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

export function generatedFilePath(root: string, playId: string, versionId: string): string {
  return join(root, 'curation', playId, 'generated', `${versionId}.json`);
}

export async function loadGeneratedFile(path: string): Promise<GeneratedFile | undefined> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
  return GeneratedFileSchema.parse(JSON.parse(text));
}

/** The file as written: one entry per line, so review edits make small diffs. */
export function formatGeneratedFile(file: GeneratedFile): string {
  const list = (items: readonly unknown[]) =>
    items.length === 0
      ? '[]'
      : `[\n${items.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`;
  return (
    `{\n  "model": ${JSON.stringify(file.model)},\n` +
    `  "generatedAt": ${JSON.stringify(file.generatedAt)},\n` +
    `  "promptVersion": ${String(file.promptVersion)},\n` +
    `  "entries": ${list(file.entries)},\n` +
    `  "notNeeded": ${list(file.notNeeded)}\n}\n`
  );
}

/** Orders occurrences as the text runs. */
export function documentOrder(doc: VersionDocument) {
  const index = new Map(textNodes(doc).map((node, i) => [node.id, i]));
  return (a: { nodeId: string; start: number }, b: { nodeId: string; start: number }) =>
    (index.get(a.nodeId) ?? -1) - (index.get(b.nodeId) ?? -1) || a.start - b.start;
}

const SAMPLE_SEED = 'shakespeer-generated-definitions';
const SAMPLE_SIZE = 100;
/** More rejected than this share of the sample, and the play's set does not ship (GEN-021). */
const MAX_REJECTED = 0.1;

/** The review sample: entries ranked by a hash of the fixed seed and their position (GEN-021). */
export function reviewSample<T extends { nodeId: string; start: number }>(entries: T[]): T[] {
  const rank = (entry: T) =>
    createHash('sha256')
      .update(`${SAMPLE_SEED}:${entry.nodeId}:${String(entry.start)}`)
      .digest('hex');
  return entries
    .map((entry) => ({ entry, rank: rank(entry) }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
    .slice(0, SAMPLE_SIZE)
    .map(({ entry }) => entry);
}

export interface GeneratedReport {
  counts: Record<GeneratedEntry['status'], number>;
  /** Entries that failed a check (GEN-020). */
  dropped: { entry: GeneratedEntry; reason: string }[];
  sample: { size: number; unreviewed: number; rejected: number };
  /** Why the set does not ship, if it does not (GEN-021). */
  withheld?: string;
}

const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}]/gu, '');

function problem(entry: GeneratedEntry, node: TextNode | undefined): string | undefined {
  if (node?.text.slice(entry.start, entry.end) !== entry.word) {
    return 'span is not the word';
  }
  const meaning = entry.meaning.trim();
  if (meaning === '') {
    return 'empty meaning';
  }
  if (meaning.length > 200) {
    return 'meaning too long';
  }
  if (letters(meaning) === letters(entry.word)) {
    return 'meaning repeats the word';
  }
  return undefined;
}

/** Entries that pass the checks of GEN-020, and those that do not with why. */
export function partitionEntries(
  doc: VersionDocument,
  file: GeneratedFile,
): { valid: GeneratedEntry[]; dropped: { entry: GeneratedEntry; reason: string }[] } {
  const nodes = new Map(textNodes(doc).map((node) => [node.id, node]));
  const valid: GeneratedEntry[] = [];
  const dropped: { entry: GeneratedEntry; reason: string }[] = [];
  for (const entry of file.entries) {
    const reason = problem(entry, nodes.get(entry.nodeId));
    if (reason) {
      dropped.push({ entry, reason });
    } else {
      valid.push(entry);
    }
  }
  return { valid, dropped };
}

/**
 * The terms a play ships from its generated definitions: entries that pass the checks
 * (GEN-020), not rejected, and only once the review sample passes (GEN-021).
 */
export function checkGenerated(
  doc: VersionDocument,
  file: GeneratedFile,
): { terms: SourcedTerm[]; report: GeneratedReport } {
  const nodes = new Map(textNodes(doc).map((node) => [node.id, node]));
  const report: GeneratedReport = {
    counts: { auto: 0, reviewed: 0, rejected: 0 },
    dropped: [],
    sample: { size: 0, unreviewed: 0, rejected: 0 },
  };
  for (const entry of file.entries) {
    report.counts[entry.status] += 1;
  }
  const { valid, dropped } = partitionEntries(doc, file);
  report.dropped = dropped;

  const sample = reviewSample(valid);
  report.sample = {
    size: sample.length,
    unreviewed: sample.filter((e) => e.status === 'auto').length,
    rejected: sample.filter((e) => e.status === 'rejected').length,
  };
  if (sample.length === 0) {
    report.withheld = 'no entries';
  } else if (report.sample.unreviewed > 0) {
    report.withheld = `${String(report.sample.unreviewed)} of the ${String(sample.length)} sampled entries not yet reviewed (list them with --sample)`;
  } else if (report.sample.rejected > sample.length * MAX_REJECTED) {
    report.withheld = `${String(report.sample.rejected)} of the ${String(sample.length)} sampled entries rejected (more than 10%)`;
  }
  if (report.withheld) {
    return { terms: [], report };
  }

  const terms = valid
    .filter((entry) => entry.status !== 'rejected')
    .sort(documentOrder(doc))
    .map((entry): SourcedTerm => {
      const node = nodes.get(entry.nodeId) as TextNode;
      return {
        id: `${GENERATED_SOURCE_ID}:${entry.nodeId}:${String(entry.start)}`,
        anchor: anchorFor(node, entry, doc.revision),
        headword: entry.word,
        definitions: [
          {
            meaning: entry.meaning.trim(),
            ...(entry.partOfSpeech ? { partOfSpeech: entry.partOfSpeech } : {}),
          },
        ],
      };
    });
  return { terms, report };
}
