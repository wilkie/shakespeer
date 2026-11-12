/**
 * A play's scholarship snapshot as gathered (SCH-011), and what ingest ships from it (SCH-002,
 * SCH-003, SCH-012).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import { HUMANITIES_FIELD, linePhrases, titleKey } from '../../src/scholarship.ts';
import {
  ScholarshipWorkSchema,
  type ScholarshipFile,
  type ScholarshipWork,
  type VersionDocument,
} from '../../src/schema.ts';
import { textNodes } from '../lib/revision.ts';
import { speechLines } from './gather.ts';

export const GatheredWorkSchema = ScholarshipWorkSchema.extend({ field: z.string() });
export type GatheredWork = z.infer<typeof GatheredWorkSchema>;

export const ScholarshipCurationSchema = z.object({
  /** The date of the last lookup, YYYY-MM-DD. */
  retrievedAt: z.iso.date(),
  queryVersion: z.int().positive(),
  /** Every looked-up line's ID, with the IDs of the works quoting it (empty when none). */
  lines: z.record(z.string(), z.array(z.string())),
  works: z.record(z.string(), GatheredWorkSchema),
  /** Works a person removed; they never ship. */
  rejected: z.array(z.string()),
});
export type ScholarshipCuration = z.infer<typeof ScholarshipCurationSchema>;

export function scholarshipFilePath(root: string, playId: string, versionId: string): string {
  return join(root, 'curation', playId, 'scholarship', `${versionId}.json`);
}

export async function loadScholarshipCuration(
  path: string,
): Promise<ScholarshipCuration | undefined> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
  return ScholarshipCurationSchema.parse(JSON.parse(text));
}

/** The file as written: one line or work per line of text, so changes make small diffs. */
export function formatScholarshipCuration(file: ScholarshipCuration): string {
  const map = (record: Record<string, unknown>) => {
    const keys = Object.keys(record).sort();
    return keys.length === 0
      ? '{}'
      : `{\n${keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(record[k])}`).join(',\n')}\n  }`;
  };
  return (
    `{\n  "retrievedAt": ${JSON.stringify(file.retrievedAt)},\n` +
    `  "queryVersion": ${String(file.queryVersion)},\n` +
    `  "lines": ${map(file.lines)},\n` +
    `  "works": ${map(file.works)},\n` +
    `  "rejected": ${JSON.stringify([...file.rejected].sort())}\n}\n`
  );
}

/** A work quoting this share of a version's lines or more reprints the play (SCH-003). */
const REPRINT_SHARE = 0.25;

export interface ScholarshipReport {
  lines: number;
  linesWithWorks: number;
  works: number;
  dropped: { reprints: number; outsideField: number; rejected: number; staleLines: number };
}

/** What a play ships from its snapshot (SCH-012). */
export function buildScholarship(
  doc: VersionDocument,
  curation: ScholarshipCuration,
): { file: ScholarshipFile; report: ScholarshipReport } {
  const nodes = new Set(textNodes(doc).map((node) => node.id));
  // The lines that can be looked up at all (SCH-003).
  const versionLines = linePhrases(speechLines(doc)).size;

  // Records of one work are merged under the first ID in order (SCH-003).
  const canonical = new Map<string, string>();
  const byTitle = new Map<string, string>();
  for (const id of Object.keys(curation.works).sort()) {
    const work = curation.works[id] as GatheredWork;
    const key = titleKey(work.title) || id;
    const first = byTitle.get(key) ?? id;
    byTitle.set(key, first);
    canonical.set(id, first);
  }
  const quoted = new Map<string, Set<string>>();
  for (const [lineId, ids] of Object.entries(curation.lines)) {
    for (const id of ids) {
      const work = canonical.get(id) ?? id;
      quoted.set(work, (quoted.get(work) ?? new Set()).add(lineId));
    }
  }
  const reprinted = new Set(
    [...quoted].filter(([, lines]) => lines.size >= versionLines * REPRINT_SHARE).map(([id]) => id),
  );
  const rejected = new Set(curation.rejected.map((id) => canonical.get(id) ?? id));

  const report: ScholarshipReport = {
    lines: Object.keys(curation.lines).length,
    linesWithWorks: 0,
    works: 0,
    dropped: {
      reprints: reprinted.size,
      outsideField: 0,
      rejected: rejected.size,
      staleLines: 0,
    },
  };
  const outside = new Set<string>();
  const lines: Record<string, string[]> = {};
  const works: Record<string, ScholarshipWork> = {};
  for (const lineId of Object.keys(curation.lines).sort()) {
    if (!nodes.has(lineId)) {
      report.dropped.staleLines += 1;
      continue;
    }
    const ids = [...new Set((curation.lines[lineId] ?? []).map((id) => canonical.get(id) ?? id))]
      .filter((id) => {
        const work = curation.works[id];
        if (!work) return false;
        if (work.field !== HUMANITIES_FIELD) {
          outside.add(id);
          return false;
        }
        return !reprinted.has(id) && !rejected.has(id);
      })
      // Most recent first (SCH-021).
      .sort((a, b) => {
        const wa = curation.works[a] as GatheredWork;
        const wb = curation.works[b] as GatheredWork;
        return (wb.year ?? 0) - (wa.year ?? 0) || wa.title.localeCompare(wb.title);
      });
    if (ids.length > 0) {
      lines[lineId] = ids;
      for (const id of ids) {
        const { field: _field, ...work } = curation.works[id] as GatheredWork;
        works[id] = work;
      }
    }
  }
  report.dropped.outsideField = outside.size;
  report.linesWithWorks = Object.keys(lines).length;
  report.works = Object.keys(works).length;
  // Every record of a reprint, so a live lookup drops it whichever record it finds (SCH-030).
  const reprints = [...canonical]
    .filter(([, c]) => reprinted.has(c))
    .map(([id]) => id)
    .sort();
  return {
    file: {
      schemaVersion: 1,
      playId: doc.playId,
      versionId: doc.versionId,
      retrievedAt: curation.retrievedAt,
      lines,
      works,
      reprints,
    },
    report,
  };
}
