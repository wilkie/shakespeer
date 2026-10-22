/**
 * What the model is asked for one candidate word (GEN-011): every occurrence with two lines of
 * context on each side, and nothing from any glossary (GEN-012).
 */
import { z } from 'zod';

import { PartOfSpeechSchema } from '../../src/schema.ts';
import type { Candidate, Occurrence, SpeechLine } from './candidates.ts';

/** Bump when the instructions or the request change, so a file is never mixed (GEN-013). */
export const PROMPT_VERSION = 2;

/** Occurrences per request, for frequent words (GEN-011). */
export const BATCH_SIZE = 40;

const CONTEXT_LINES = 2;

export const SYSTEM_PROMPT = `You write glosses for readers of Shakespeare who know modern English but not Shakespeare's.

You are given one word from a play and passages where it occurs, two lines either side, with the occurrence marked ⟦like this⟧. For each numbered occurrence, decide whether a modern reader needs it explained there:

- If the word means there what it ordinarily means in modern English, or only its spelling or an elision differs in a way a reader will work out, set "needed" to false and leave "meaning" empty.
- Otherwise set "needed" to true and give its sense in that passage as "meaning": a dictionary-style gloss in plain modern English, at most 25 words, without quotation marks, without repeating the word itself, and without explaining the plot. Give its part of speech there, or null if none fits.
- A proper name (a person, god, place or thing alluded to) needs a definition unless a modern reader will know it: say briefly who or what it is, as its meaning, with part of speech "noun".

Occurrences in the same sense may share a meaning. Answer every occurrence, by its number.`;

export const ResponseSchema = z.object({
  occurrences: z.array(
    z.object({
      occurrence: z.int(),
      needed: z.boolean(),
      meaning: z.string(),
      partOfSpeech: PartOfSpeechSchema.nullable(),
    }),
  ),
});
export type ModelResponse = z.infer<typeof ResponseSchema>;

/** A word's occurrences in request-sized batches. */
export function batches(candidate: Candidate): Occurrence[][] {
  const result: Occurrence[][] = [];
  for (let i = 0; i < candidate.occurrences.length; i += BATCH_SIZE) {
    result.push(candidate.occurrences.slice(i, i + BATCH_SIZE));
  }
  return result;
}

/** Finds an occurrence's line and its neighbours in the scene. */
export function contextIndex(scenes: SpeechLine[][]) {
  const where = new Map<string, { lines: SpeechLine[]; index: number }>();
  for (const lines of scenes) {
    lines.forEach((line, index) => {
      where.set(line.nodeId, { lines, index });
    });
  }
  return where;
}

/** The request for one batch of a word's occurrences. */
export function requestText(
  playTitle: string,
  word: string,
  occurrences: readonly Occurrence[],
  context: ReturnType<typeof contextIndex>,
): string {
  const passages = occurrences.map((occurrence, i) => {
    const found = context.get(occurrence.nodeId);
    if (!found) {
      throw new Error(`No speech line ${occurrence.nodeId}`);
    }
    const { lines, index } = found;
    const shown = lines.slice(Math.max(0, index - CONTEXT_LINES), index + CONTEXT_LINES + 1);
    const text = shown
      .map((line) => {
        const body =
          line.nodeId === occurrence.nodeId
            ? `${line.text.slice(0, occurrence.start)}⟦${occurrence.word}⟧${line.text.slice(occurrence.end)}`
            : line.text;
        return `  ${line.speaker}: ${body}`;
      })
      .join('\n');
    return `Occurrence ${String(i + 1)} (${lines[index]?.scene ?? ''}):\n${text}`;
  });
  return `Play: ${playTitle}\nWord: ${word}\n\n${passages.join('\n\n')}`;
}
