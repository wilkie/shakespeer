# Corpus

Status: Draft

The plays, their versions, and everything shipped with them: structure, permanent IDs, line
numbers, alignment between versions, curated variants, sourced definitions, and the source
registry. The corpus lives in the repository and is read-only at runtime.

## Contents of the first release

| Play                   | ID                     | Versions                                                                               |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| _Hamlet_               | `hamlet`               | `folger`, `q1-1603` (First Quarto), `q2-1604` (Second Quarto), `f1-1623` (First Folio) |
| _Troilus and Cressida_ | `troilus-and-cressida` | `folger`, `q1-1609` (Quarto), `f1-1623` (First Folio)                                  |
| _The Tempest_          | `the-tempest`          | `folger`, `f1-1623` (First Folio; the only early printing)                             |

| Source                                                                     | Used for                        | License (to verify at ingestion)                      |
| -------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| Folger Shakespeare (Folger Shakespeare Library), TEI XML                   | `folger` versions; glosses      | CC BY-NC 3.0                                          |
| EEBO-TCP transcriptions (Text Creation Partnership)                        | quarto and folio versions       | CC0 1.0 (public domain dedication)                    |
| Schmidt, _Shakespeare-Lexicon_ (1874–75), Perseus Digital Library encoding | sourced definitions             | Public-domain text; check the encoding's license      |
| Onions, _A Shakespeare Glossary_ (1911)                                    | sourced definitions             | Public domain; digitization source to be chosen       |
| _Shakespeare's Words_ (David & Ben Crystal), shakespeareswords.com         | sourced definitions (candidate) | Copyrighted; usable only with the authors' permission |

## Repository layout

- **CRP-001** — The corpus MUST live in the workspace package `@shakespeer/corpus`
  (`packages/corpus`):
  - `sources.json` — the source registry (CRP-080).
  - `plays.json` — the play index (CRP-010).
  - `plays/<playId>/<versionId>.json` — one file per version (CRP-020).
  - `plays/<playId>/alignment/<versionId>.json` — alignment of each original version to the
    modern version (CRP-050).
  - `plays/<playId>/variants.json` — curated variants (CRP-060).
  - `plays/<playId>/definitions/<sourceId>.json` — sourced definitions (CRP-070).
  - `ingest/` — the scripts that produce all of the above from the sources.
- **CRP-002** — Generated files MUST be committed, so the app builds without network access.
  Raw source files are not committed; `ingest/sources.lock.json` pins each by URL and SHA-256.
- **CRP-003** — Ingestion MUST be deterministic: running it twice on the same pinned sources
  produces byte-identical output. CI MUST verify that committed data validates against the JSON
  Schemas in `packages/corpus/schema/`.
- **CRP-004** — Hand-made corrections (alignment overrides, variant notes, text corrections) MUST
  live in separate, reviewed files under `packages/corpus/curation/` that ingestion applies, so
  re-ingesting never loses them.
- **CRP-005** — The app MUST load the play index eagerly and each version's files lazily, only
  when that version is opened. A version file SHOULD stay under 400 KB gzipped.

## Play index

- **CRP-010** — `plays.json` MUST list each play with: `id`, `title`, `shortTitle`, `genre`,
  `composed` (`{ "from": 1599, "to": 1601 }`), `modernVersionId`, and `versions`: each with `id`,
  `name` ("Second Quarto (1604)"), `shortName` ("Q2"), `kind` (`modern` | `original`),
  `printed` (year, for originals), and `sourceIds`.

## Version documents

- **CRP-020** — A version document MUST contain: `schemaVersion`, `playId`, `versionId`,
  `revision` (CRP-025), `characters`, and `divisions` — an ordered list of acts, each an ordered
  list of scenes, each an ordered list of blocks. Prologues, epilogues and inductions are scenes
  with `kind` `prologue` / `epilogue` / `induction`.
- **CRP-021** — Blocks are **speeches** (`speakers`: character IDs; `label`: the speaker name as
  printed; `nodes`: lines and stage directions) and free-standing **stage directions**.
- **CRP-022** — **Text nodes** are the only things notes attach to. Each has `id`, `kind`
  (`line` | `sd`), and `text`: the displayed text as a plain Unicode string, NFC-normalized. A
  line also has `form` (`verse` | `prose`), optionally `part` (`initial` | `medial` | `final`, for
  split verse lines) and `n` (its line number, CRP-040). A stage direction that interrupts a line
  is stored as its own node after that line, with `inlineAt`: the character offset where it
  appears.
- **CRP-023** — Inline presentation (italics, small caps, songs, the gap marker of CRP-032) MUST
  be stored as `marks` (`{ start, end, type }` over `text`), never as characters inside `text`, so
  character offsets are the same however the text is styled.
- **CRP-024** — Text node IDs MUST be opaque strings, unique within the version, and permanent:
  an ID is never reused or reassigned to different text. IDs derive from stable source IDs where
  the source has them (Folger's line IDs); otherwise ingestion assigns them and records them in
  a committed ID map (`ingest/ids/<playId>-<versionId>.json`) so re-ingestion preserves them.
  Splitting or merging nodes in a correction creates new IDs and records the old ones in
  `replaces` for anchor repair (ANC-031).
- **CRP-025** — `revision` MUST be a content hash of the version's text nodes. Each change to a
  version's text adds an entry to `plays/<playId>/CHANGES.md` listing affected node IDs.

## Original versions

- **CRP-030** — Original versions MUST preserve the printed spelling, punctuation,
  capitalization, u/v and i/j usage, abbreviations and tildes. Long s is shown as "s". Line-end
  hyphenation within a word is joined. Running heads, catchwords and signatures are omitted from
  the text; page breaks are kept as `pageBreaks` (`{ nodeId, offset, label }`, e.g. `"sig. G4v"`)
  for citation.
- **CRP-031** — Where an original lacks act or scene divisions, ingestion MUST supply
  **editorial divisions** taken through alignment from the modern version, flagged
  `editorial: true`. Printed divisions are flagged `editorial: false`.
- **CRP-032** — Illegible or missing characters in a transcription are represented by "•" in
  `text` with a `gap` mark, so they remain countable and visible.
- **CRP-033** — Speeches in original versions keep the printed speaker abbreviation as `label`
  and are linked to the modern version's characters through `characters[].modernId`.

## Line numbers

- **CRP-040** — The modern version MUST use the Folger edition's act.scene.line numbering, as
  given by the source.
- **CRP-041** — Original versions MUST show, as `n`, the modern line number of the aligned modern
  line (for display and cross-reference, and for URL fragments, RDR-031). Lines without a
  counterpart have no `n` and are addressed by their position after the nearest numbered line
  (`#3.1.56+2`).

## Alignment

- **CRP-050** — For each original version, `alignment/<versionId>.json` MUST map every text node
  to the modern version: a list of entries `{ "orig": [ids], "modern": [ids], "relation" }`, where
  `relation` is `same` (equivalent, allowing for spelling and punctuation), `variant` (different
  wording), `orig-only`, `modern-only`, or `moved` (equivalent text at a different place).
- **CRP-051** — Alignment MUST be produced by an automatic aligner (spelling normalization, then
  sequence alignment within scenes, with a fallback for Q1 _Hamlet_'s different scene order)
  followed by curated overrides (CRP-004). Each entry records `status`: `auto` or `reviewed`.
- **CRP-052** — Ingestion MUST report alignment coverage (share of `reviewed` entries) per version;
  the first release does not require full review but MUST NOT ship a version below a coverage
  threshold to be agreed.

## Variants

- **CRP-060** — `variants.json` MUST list curated notable variants: `id`, `title`, `note`
  (Markdown), `sourceIds` (where the observation comes from), and `readings`: one per version,
  each an anchor-like span (`start`, `end`, as in ANC-002) with its text. These are displayed
  later (RDR-043) but are curated alongside alignment from the start.

## Sourced definitions

- **CRP-070** — `definitions/<sourceId>.json` MUST contain terms: each with `id`, `versionId`, an
  anchor (ANC-002) to one specific occurrence, the `headword` as the source prints it, and one or
  more definitions (`meaning`, `partOfSpeech`, optional `sense` label such as "1b").
- **CRP-071** — Lexicon entries cite passages (Schmidt cites act, scene and line in the Globe
  edition). Ingestion MUST match each citation to the occurrence of the headword (allowing for
  inflection and spelling) within a small window around the cited line in the modern version,
  and attach the matching sense there. Ambiguous or unmatched citations MUST be skipped and
  logged, never guessed: precision over coverage.
- **CRP-072** — Sourced definitions for original versions MAY be derived from the modern
  version's through alignment where the aligned line contains the same word; otherwise original
  versions have none.

## Source registry

- **CRP-080** — `sources.json` MUST describe each source: `id`, `name`, `shortName`,
  `description`, `url`, `license` (`name`, `url`, `commercialUse`: boolean), and
  `attribution` (the exact text to display). See [ATR](../behavior/attribution.md).

## Open questions

1. The cloud environment's network policy currently blocks `folger.edu`, `shakespeareswords.com`,
   `gutenberg.org` and `archive.org` (EEBO-TCP on GitHub is reachable). Either allow those hosts
   in the environment's network settings, or download the source files and commit them under
   `packages/corpus/ingest/raw/` (Folger's license permits non-commercial redistribution with
   attribution).
2. _Shakespeare's Words_ has excellent, context-specific glosses but is not openly licensed.
   Ask the publishers for permission to include its glosses (with attribution and a link per
   definition)? Without permission it can still be offered as an external "Look up on
   Shakespeare's Words" link from a term, which needs no license.
3. Do the Folger downloads include the edition's glosses, and under what terms? If not, Folger
   definitions are dropped from the first release.
4. Should the First Folio also show Hinman's Through Line Numbers (TLN), the standard for
   citing F1? Computing them reliably needs page-layout data that EEBO-TCP may not carry.
5. Alignment coverage threshold for shipping (CRP-052): proposed 100% reviewed for scene
   divisions and speaker attribution, and at least spot-checked line alignment.
