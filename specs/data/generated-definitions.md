# Generated definitions

Status: Approved

Definitions written by a language model for words a modern reader is likely to stumble on, where
the public-domain glossaries ([CRP-070](corpus.md)) give none. This details
[CRP-074](corpus.md) and [DEF-014](../behavior/definitions.md). Generated definitions are a
corpus source like any other: committed, read-only, switchable, and clearly labelled. No model
is ever called by the app or by the ingest run ([CRP-006](corpus.md)).

## Which words

- **GEN-001** — Candidates MUST be chosen deterministically from the modern version's text, one
  per occurrence (DEF-001):
  - words not in a pinned list of common modern English (SCOWL, size 50, pinned in
    `sources.lock.json` like any source), compared by lower-cased form and its obvious
    inflections; and
  - occurrences of any headword either glossary defines elsewhere in the play.
- **GEN-002** — Excluded from candidates: occurrences that already have a sourced definition;
  character names and the play's other proper names (capitalized words not at the start of a
  line that are not glossary headwords); words in stage directions; numbers.
- **GEN-003** — Generation is for the modern version only. Original versions get none until
  definitions can be carried across alignment (CRP-072).

## How they are made

- **GEN-010** — Definitions are produced by a separate, optional step (CRP-006), run by hand:
  `pnpm --filter @shakespeer/corpus generate-definitions --play <playId>`. It calls a language
  model through its API (the key comes from the environment, never the repository) and writes
  its results as a curation file. Re-running it only fills in candidates without an entry, so
  reviewed entries are never overwritten.
- **GEN-011** — The model is asked about one candidate word at a time, with every occurrence of
  it in the play and two lines of context on each side. For each occurrence it gives the sense
  there as a short meaning (at most 25 words) and an optional part of speech, or says that no
  definition is needed (the modern sense applies). Occurrences in the same sense MAY share a
  meaning.
- **GEN-012** — The request MUST NOT include any glossary's definitions, so generated text is
  never a paraphrase of a source's entries (Onions is in copyright outside the US).
- **GEN-013** — The curation file is `curation/<playId>/generated/<versionId>.json`:
  `{ model, generatedAt, promptVersion, entries }`, each entry `{ nodeId, start, end, word,
meaning, partOfSpeech?, status }` where `status` is `auto`, `reviewed` or `rejected`.

## Checks and review

- **GEN-020** — Ingest MUST drop, and report, any entry whose span is not the stated word in the
  current text, whose meaning is empty or longer than 200 characters, or whose meaning repeats
  the word itself as its only content. Rejected entries are never shipped.
- **GEN-021** — Before a play's generated definitions ship for the first time, a person MUST
  review a random sample of at least 100 entries (chosen by a fixed seed, so the sample is
  reproducible), marking each `reviewed` or `rejected`. If more than 10% of the sample is
  rejected, that play's set does not ship until the prompt or model is changed and a new sample
  passes.
- **GEN-022** — Ingest MUST report, per play, how many entries are `auto`, `reviewed` and
  `rejected`.

## Output and display

- **GEN-030** — Ingest writes `definitions/<versionId>/generated.json` in the sourced
  definitions format (CRP-070) under source ID `generated`. Its `sources.json` entry
  (CRP-080) names the model and the generation date in its description and attribution.
- **GEN-031** — In the panel, generated definitions are listed after the other sourced
  definitions (DEF-031), labelled "Generated", with the model and date shown on the source
  (ATR-010) and a note that they may be wrong.
- **GEN-032** — "Generated" appears under Definition sources (DEF-012) and can be switched off
  like any source.

## Decisions

1. The generation step is the script of GEN-010, run by the maintainer with an API key.
2. Generated definitions are on by default, like the other sources.
3. The generated text is licensed CC0 1.0, stated in its `sources.json` entry.
4. Single words only at first; multi-word idioms later, from a curated list.
