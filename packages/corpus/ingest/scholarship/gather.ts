/**
 * Gathers a play's scholarship snapshot (SCH-010): looks up each line's phrase, saving as it goes;
 * a re-run looks up only the lines without an answer.
 */
import { SCHOLARSHIP_QUERY_VERSION, linePhrases, type FoundWork } from '../../src/scholarship.ts';
import type { VersionDocument } from '../../src/schema.ts';
import type { ScholarshipCuration } from './file.ts';

/** One lookup; undefined when OpenAlex gave no answer (asked again on the next run). */
export type FindWorks = (phrase: string) => Promise<FoundWork[] | undefined>;

export interface GatherOptions {
  doc: VersionDocument;
  existing: ScholarshipCuration | undefined;
  findWorks: FindWorks;
  save: (file: ScholarshipCuration) => Promise<void>;
  /** Today, YYYY-MM-DD. */
  today: string;
  /** Only lines whose number this accepts (--from, --to). */
  include?: (lineNumber: string) => boolean;
  log?: (message: string) => void;
}

export interface GatherResult {
  file: ScholarshipCuration;
  asked: number;
  failed: number;
}

/** A version's speeches as lists of lines, stage directions left out. */
export function speechLines(doc: VersionDocument) {
  return doc.divisions.flatMap((act) =>
    act.scenes.flatMap((scene) =>
      scene.blocks.flatMap((block) =>
        block.type === 'speech'
          ? [
              block.nodes.flatMap((node) =>
                node.kind === 'line' ? [{ id: node.id, text: node.text, n: node.n ?? '' }] : [],
              ),
            ]
          : [],
      ),
    ),
  );
}

export async function gatherScholarship({
  doc,
  existing,
  findWorks,
  save,
  today,
  include = () => true,
  log = () => undefined,
}: GatherOptions): Promise<GatherResult> {
  if (existing && existing.queryVersion !== SCHOLARSHIP_QUERY_VERSION) {
    throw new Error(
      `The snapshot was gathered with query version ${String(existing.queryVersion)}, not ` +
        `${String(SCHOLARSHIP_QUERY_VERSION)}. Move it aside to gather a new one (SCH-011).`,
    );
  }
  const file: ScholarshipCuration = {
    retrievedAt: today,
    queryVersion: SCHOLARSHIP_QUERY_VERSION,
    lines: { ...existing?.lines },
    works: { ...existing?.works },
    rejected: [...(existing?.rejected ?? [])],
  };
  const speeches = speechLines(doc);
  const numbers = new Map(speeches.flat().map((line) => [line.id, line.n]));
  const pending = [...linePhrases(speeches)].filter(
    ([id]) => !(id in file.lines) && include(numbers.get(id) ?? ''),
  );
  log(`${String(pending.length)} lines to look up`);

  const result: GatherResult = { file, asked: 0, failed: 0 };
  for (const [id, phrase] of pending) {
    const works = await findWorks(phrase);
    result.asked += 1;
    if (!works) {
      result.failed += 1;
      continue;
    }
    file.lines[id] = [...new Set(works.map((work) => work.id))];
    for (const work of works) {
      file.works[work.id] = work;
    }
    if (result.asked % 25 === 0) {
      log(`  ${String(result.asked)}/${String(pending.length)}`);
      await save(file);
    }
  }
  await save(file);
  return result;
}
