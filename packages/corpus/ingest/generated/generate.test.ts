import { describe, expect, it } from '@jest/globals';

import { selectCandidates, type Candidate } from './candidates.ts';
import type { GeneratedFile } from './file.ts';
import { common, doc, sourced } from './fixture.ts';
import { generateDefinitions, type AskModel } from './generate.ts';
import { BATCH_SIZE, PROMPT_VERSION, type ModelResponse } from './prompt.ts';

const candidates = selectCandidates(doc, sourced, common);

/** A model that defines every occurrence of "yare" and says the rest need nothing. */
function fakeModel() {
  const requests: string[] = [];
  const ask: AskModel = (_system, text) => {
    requests.push(text);
    const count = text.match(/^Occurrence \d+/gm)?.length ?? 0;
    const word = /^Word: (.*)$/m.exec(text)?.[1];
    const response: ModelResponse = {
      occurrences: Array.from({ length: count }, (_, i) => ({
        occurrence: i + 1,
        needed: word === 'yare',
        meaning: word === 'yare' ? 'quick, nimble' : '',
        partOfSpeech: word === 'yare' ? 'adjective' : null,
      })),
    };
    return Promise.resolve(response);
  };
  return { ask, requests };
}

async function run(existing: GeneratedFile | undefined, ask: AskModel, model = 'claude-opus-5-5') {
  const saved: GeneratedFile[] = [];
  const result = await generateDefinitions({
    doc,
    playTitle: 'The Tempest',
    candidates,
    existing,
    model,
    ask,
    save: (file) => {
      saved.push(file);
      return Promise.resolve();
    },
    today: '2026-10-11',
    concurrency: 2,
  });
  return { result, saved };
}

describe('generateDefinitions', () => {
  it('GEN-011/012: asks a word at a time with every occurrence in context, and no glossary text', async () => {
    const { ask, requests } = fakeModel();
    await run(undefined, ask);
    expect(requests).toHaveLength(candidates.length);
    const yare = requests.find((r) => r.includes('Word: yare')) as string;
    expect(yare).toContain('Play: The Tempest');
    expect(yare.match(/^Occurrence \d+ \(Act 1, Scene 1\):$/gm)).toHaveLength(3);
    // The occurrence is marked, with its neighbouring lines and their speakers.
    expect(yare).toContain('  PROSPERO: Good Gonzalo, be ⟦yare⟧ and tend the master.');
    expect(yare).toContain('  PROSPERO: ⟦Yare⟧, yare! Take in the topsail.');
    expect(yare).toContain('  PROSPERO: Thou art still a fool, I think.');
    // Two lines either side: line 5 is too far from line 2.
    const second = yare.split('Occurrence 2')[1]?.split('Occurrence 3')[0] ?? '';
    expect(second).not.toContain('Whither');
    for (const request of requests) {
      expect(request).not.toContain('a gloss of');
    }
  });

  it('GEN-011: splits a frequent word into batches', async () => {
    const many: Candidate = {
      word: 'yare',
      // Spans need not be real here: only the requests are checked.
      occurrences: Array.from({ length: BATCH_SIZE + 1 }, (_, i) => ({
        nodeId: 'ftln-0001',
        start: i,
        end: i + 4,
        word: 'yare',
      })),
    };
    const { ask, requests } = fakeModel();
    await generateDefinitions({
      doc,
      playTitle: 'The Tempest',
      candidates: [many],
      existing: undefined,
      model: 'm',
      ask,
      save: () => Promise.resolve(),
      today: '2026-10-11',
    });
    expect(requests.map((r) => r.match(/^Occurrence \d+/gm)?.length)).toEqual([BATCH_SIZE, 1]);
  });

  it('GEN-010/013: records definitions and occurrences that need none, in text order', async () => {
    const { ask } = fakeModel();
    const { result, saved } = await run(undefined, ask);
    const file = saved.at(-1) as GeneratedFile;
    expect(file).toMatchObject({
      model: 'claude-opus-5-5',
      generatedAt: '2026-10-11',
      promptVersion: PROMPT_VERSION,
    });
    expect(file.entries).toEqual([
      {
        nodeId: 'ftln-0001',
        start: 17,
        end: 21,
        word: 'yare',
        meaning: 'quick, nimble',
        partOfSpeech: 'adjective',
        status: 'auto',
      },
      {
        nodeId: 'ftln-0002',
        start: 0,
        end: 4,
        word: 'Yare',
        meaning: 'quick, nimble',
        partOfSpeech: 'adjective',
        status: 'auto',
      },
      {
        nodeId: 'ftln-0002',
        start: 6,
        end: 10,
        word: 'yare',
        meaning: 'quick, nimble',
        partOfSpeech: 'adjective',
        status: 'auto',
      },
    ]);
    expect(file.notNeeded.map((o) => o.word)).toEqual([
      'Still',
      'Whither',
      'Whither',
      'wilt',
      'wast',
    ]);
    expect(result).toMatchObject({ added: 3, notNeeded: 5, failed: 0 });
  });

  it('GEN-010: a re-run asks only about what has no answer, and never changes reviewed entries', async () => {
    const first = await run(undefined, fakeModel().ask);
    const file = structuredClone(first.saved.at(-1) as GeneratedFile);
    file.entries = file.entries
      .slice(0, 1)
      .map((e) => ({ ...e, meaning: 'ready', status: 'reviewed' }));
    file.notNeeded = file.notNeeded.filter((o) => o.word !== 'wast');

    const { ask, requests } = fakeModel();
    const { saved } = await run(file, ask);
    expect(requests.map((r) => /^Word: (.*)$/m.exec(r)?.[1])).toEqual(['yare', 'wast']);
    // Only the two occurrences of "yare" without an entry were asked about.
    expect(requests[0]?.match(/^Occurrence \d+/gm)).toHaveLength(2);
    const after = saved.at(-1) as GeneratedFile;
    expect(after.entries[0]).toMatchObject({ meaning: 'ready', status: 'reviewed' });
    expect(after.entries).toHaveLength(3);
  });

  it('GEN-010: leaves unanswered batches for the next run', async () => {
    const ask: AskModel = () => Promise.resolve(undefined);
    const { result } = await run(undefined, ask);
    expect(result).toMatchObject({ added: 0, notNeeded: 0, failed: candidates.length });
  });

  it('GEN-013: refuses to extend a file made with another model or prompt version', async () => {
    const existing: GeneratedFile = {
      model: 'claude-opus-5',
      generatedAt: '2026-10-01',
      promptVersion: PROMPT_VERSION,
      entries: [],
      notNeeded: [],
    };
    await expect(run(existing, fakeModel().ask)).rejects.toThrow(/cannot be extended/);
  });
});
