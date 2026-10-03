/**
 * Reviewed corrections applied on every ingest run (CRP-004, CRP-006). They live in
 * `curation/<playId>/<versionId>.json` and are written by people (or accepted from a
 * machine-assisted step), never by ingest itself.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import { AlignmentRelationSchema, type AlignmentEntry } from '../src/schema.ts';

const CurationSchema = z.object({
  /** Printed speech headings mapped to modern character IDs, where automatic linking fails. */
  speakers: z.record(z.string(), z.array(z.string())).optional(),
  /** Alignment entries that replace whatever the aligner produced for the same nodes. */
  alignment: z
    .array(
      z.object({
        orig: z.array(z.string()),
        modern: z.array(z.string()),
        relation: AlignmentRelationSchema,
        note: z.string().optional(),
      }),
    )
    .optional(),
});
export type Curation = z.infer<typeof CurationSchema>;

export async function loadCuration(
  root: string,
  playId: string,
  versionId: string,
): Promise<Curation> {
  const path = join(root, 'curation', playId, `${versionId}.json`);
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return {};
  }
  return CurationSchema.parse(JSON.parse(text));
}

/**
 * Replaces automatic entries touching any node of a curated entry. Nodes of a replaced entry
 * that the curated entry does not cover become `orig-only` / `modern-only`.
 */
export function applyAlignmentCuration(
  entries: AlignmentEntry[],
  curation: Curation,
): AlignmentEntry[] {
  let result = entries;
  for (const curated of curation.alignment ?? []) {
    const covered = new Set([...curated.orig, ...curated.modern]);
    const next: AlignmentEntry[] = [];
    let inserted = false;
    for (const entry of result) {
      if (![...entry.orig, ...entry.modern].some((id) => covered.has(id))) {
        next.push(entry);
        continue;
      }
      if (!inserted) {
        next.push({
          orig: curated.orig,
          modern: curated.modern,
          relation: curated.relation,
          status: 'reviewed',
        });
        inserted = true;
      }
      for (const id of entry.orig.filter((id) => !covered.has(id))) {
        next.push({ orig: [id], modern: [], relation: 'orig-only', status: 'auto' });
      }
      for (const id of entry.modern.filter((id) => !covered.has(id))) {
        next.push({ orig: [], modern: [id], relation: 'modern-only', status: 'auto' });
      }
    }
    if (!inserted) {
      throw new Error(`Curated alignment entry matches no nodes: ${[...covered].join(', ')}`);
    }
    result = next;
  }
  return result;
}
