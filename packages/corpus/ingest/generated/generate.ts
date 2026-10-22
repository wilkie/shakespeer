/**
 * Fills in a play's generated definitions file (GEN-010, GEN-011): asks the model about every
 * candidate occurrence that has no entry yet, a word at a time, saving as it goes. Entries
 * already in the file, reviewed or not, are never changed.
 */
import type { VersionDocument } from '../../src/schema.ts';
import { speechLines, type Candidate, type Occurrence } from './candidates.ts';
import { documentOrder, type GeneratedEntry, type GeneratedFile } from './file.ts';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  batches,
  contextIndex,
  requestText,
  type ModelResponse,
} from './prompt.ts';

/** One model request; undefined when the model gave no usable answer (e.g. a refusal). */
export type AskModel = (system: string, text: string) => Promise<ModelResponse | undefined>;

export interface GenerateOptions {
  doc: VersionDocument;
  playTitle: string;
  candidates: readonly Candidate[];
  /** The file so far, if any. */
  existing: GeneratedFile | undefined;
  model: string;
  ask: AskModel;
  /** Called with the file after each answered batch. */
  save: (file: GeneratedFile) => Promise<void>;
  /** Today, YYYY-MM-DD. */
  today: string;
  concurrency?: number;
  /** Stop after this many words, for a trial run. */
  maxWords?: number;
  log?: (message: string) => void;
}

export interface GenerateResult {
  file: GeneratedFile;
  asked: number;
  added: number;
  notNeeded: number;
  /** Batches without a usable answer; asked again on the next run. */
  failed: number;
}

const key = (o: { nodeId: string; start: number }) => `${o.nodeId}:${String(o.start)}`;

export async function generateDefinitions({
  doc,
  playTitle,
  candidates,
  existing,
  model,
  ask,
  save,
  today,
  concurrency = 4,
  maxWords,
  log = () => undefined,
}: GenerateOptions): Promise<GenerateResult> {
  if (existing && (existing.model !== model || existing.promptVersion !== PROMPT_VERSION)) {
    throw new Error(
      `The file was made with ${existing.model} (prompt version ${String(existing.promptVersion)}); ` +
        `it cannot be extended with ${model} (prompt version ${String(PROMPT_VERSION)}). ` +
        'Move it aside to start a new set (GEN-013).',
    );
  }
  const file: GeneratedFile = {
    model,
    generatedAt: today,
    promptVersion: PROMPT_VERSION,
    entries: [...(existing?.entries ?? [])],
    notNeeded: [...(existing?.notNeeded ?? [])],
  };
  const done = new Set([...file.entries, ...file.notNeeded].map(key));
  const pending = candidates
    .map((c) => ({ ...c, occurrences: c.occurrences.filter((o) => !done.has(key(o))) }))
    .filter((c) => c.occurrences.length > 0)
    .slice(0, maxWords);
  const work = pending.flatMap((candidate) =>
    batches(candidate).map((occurrences) => ({ word: candidate.word, occurrences })),
  );
  log(`${String(pending.length)} words to ask about in ${String(work.length)} requests`);

  const context = contextIndex(speechLines(doc));
  const order = documentOrder(doc);
  const result: GenerateResult = { file, asked: 0, added: 0, notNeeded: 0, failed: 0 };
  // Saves run one after another, each with everything answered so far.
  let saving = Promise.resolve();
  const record = (occurrences: readonly Occurrence[], response: ModelResponse) => {
    for (const answer of response.occurrences) {
      const occurrence = occurrences[answer.occurrence - 1];
      if (!occurrence || done.has(key(occurrence))) {
        continue;
      }
      done.add(key(occurrence));
      const meaning = answer.meaning.trim();
      if (answer.needed && meaning !== '') {
        const entry: GeneratedEntry = {
          ...occurrence,
          meaning,
          ...(answer.partOfSpeech ? { partOfSpeech: answer.partOfSpeech } : {}),
          status: 'auto',
        };
        file.entries.push(entry);
        result.added += 1;
      } else {
        file.notNeeded.push(occurrence);
        result.notNeeded += 1;
      }
    }
    file.entries.sort(order);
    file.notNeeded.sort(order);
    const snapshot = structuredClone(file);
    saving = saving.then(() => save(snapshot));
  };

  let next = 0;
  const worker = async () => {
    for (let item = work[next++]; item; item = work[next++]) {
      const response = await ask(
        SYSTEM_PROMPT,
        requestText(playTitle, item.word, item.occurrences, context),
      );
      result.asked += 1;
      if (response) {
        record(item.occurrences, response);
      } else {
        result.failed += 1;
        log(`  no answer for "${item.word}"`);
      }
      if (result.asked % 25 === 0) {
        log(`  ${String(result.asked)}/${String(work.length)} requests`);
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  } finally {
    // What was answered before a failure is kept.
    await saving;
  }
  return result;
}

export interface PruneResult {
  file: GeneratedFile;
  entries: number;
  notNeeded: number;
}

/**
 * Removes the `auto` entries and `notNeeded` occurrences that are no longer candidates, after
 * the rules or the text change; reviewed and rejected entries stay (GEN-010).
 */
export function pruneGenerated(file: GeneratedFile, candidates: readonly Candidate[]): PruneResult {
  const current = new Set(
    candidates.flatMap((c) => c.occurrences.map((o) => `${key(o)}:${o.word}`)),
  );
  const isCandidate = (o: Occurrence) => current.has(`${key(o)}:${o.word}`);
  const entries = file.entries.filter((e) => e.status !== 'auto' || isCandidate(e));
  const notNeeded = file.notNeeded.filter(isCandidate);
  return {
    file: { ...file, entries, notNeeded },
    entries: file.entries.length - entries.length,
    notNeeded: file.notNeeded.length - notNeeded.length,
  };
}
