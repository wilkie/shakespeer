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

| Source                                                               | Used for                                   | License                                                                                       | Verified                             |
| -------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------ |
| Folger Shakespeare, TEI XML (one zip per play from folger.edu)       | `folger` versions; variant seeds (CRP-061) | CC BY-NC 3.0 Unported (stated in each file)                                                   | Yes                                  |
| EEBO-TCP transcriptions (Text Creation Partnership, on GitHub)       | quarto and folio versions                  | CC0 1.0 (stated in each file)                                                                 | Yes (First Folio); quartos to locate |
| Schmidt, _Shakespeare-Lexicon_, 3rd ed. rev. Sarrazin (1902), 2 vols | sourced definitions                        | Public domain; archive.org scans with OCR (vol. 1: `in.ernet.dli.2015.203724`; vol. 2 to pin) | OCR needs cleanup (CRP-073)          |
| Onions, _A Shakespeare Glossary_ (1911)                              | sourced definitions                        | Public domain; archive.org scans with OCR (`shakespearegloss00oniouoft`)                      | OCR needs cleanup (CRP-073)          |

What the Folger TEI provides (checked on _Hamlet_ and _The Tempest_): every line is a
`milestone` with a permanent ID (`ftln-0001`, the Folger Through Line Number), its act.scene.line
number (`n="1.1.1"`) and verse/prose type; stage directions have IDs (`stg-0004.1`) and types
(entrance, exit, business…); every word and punctuation mark has an ID; speeches name their
characters. It does **not** include the edition's glosses. It **does** mark every editorial
emendation (228 in _Hamlet_) and every passage that comes only from the Folio (318) or only from
the Second Quarto (29).

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
  the source has them (Folger's `ftln-NNNN` line IDs and `stg-…` stage direction IDs); otherwise ingestion assigns them and records them in
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
- **CRP-061** — Ingestion MUST seed _Hamlet_'s variants from the Folger markup: passages marked
  Folio-only and Second-Quarto-only become variants with readings in the corresponding original
  versions (via alignment), and editorial emendations become variants recording the modern
  reading against the original ones. Curated notes are added on top (CRP-004).

## Sourced definitions

- **CRP-070** — `definitions/<sourceId>.json` MUST contain terms: each with `id`, `versionId`, an
  anchor (ANC-002) to one specific occurrence, the `headword` as the source prints it, and one or
  more definitions (`meaning`, `partOfSpeech`, optional `sense` label such as "1b").
- **CRP-071** — Lexicon entries cite passages (Schmidt cites act, scene and line in the Globe
  edition). Ingestion MUST match each citation to the occurrence of the headword (allowing for
  inflection and spelling) within a small window around the cited line in the modern version,
  and attach the matching sense there. Ambiguous or unmatched citations MUST be skipped and
  logged, never guessed: precision over coverage.
- **CRP-073** — Glossary text MUST be recovered from the scans' OCR by a reproducible pipeline
  in `ingest/`: rebuild reading order from word coordinates (hOCR or DjVu XML) so the two
  columns are not interleaved; split entries by headword; parse senses and citations
  (normalizing play abbreviations and misread Roman numerals). Corrections MUST be stored as
  reviewed curation files (CRP-004). Matching a citation to the headword in the corpus text
  (CRP-071) is the acceptance test for each cleaned citation. Machine assistance (including an
  LLM) MAY propose OCR corrections, but only corrections that pass that test or human review
  are kept.
- **CRP-074** — _Planned:_ generated definitions. Definitions written offline by a language model
  for words and phrases in context, committed as their own source, labeled "Generated" with the
  model and date, switchable like any source (DEF-012), and never mixed into another source's
  entries. Details to be specified after the public-domain glossaries ship.
- **CRP-072** — Sourced definitions for original versions MAY be derived from the modern
  version's through alignment where the aligned line contains the same word; otherwise original
  versions have none.

## Source registry

- **CRP-080** — `sources.json` MUST describe each source: `id`, `name`, `shortName`,
  `description`, `url`, `license` (`name`, `url`, `commercialUse`: boolean), and
  `attribution` (the exact text to display). See [ATR](../behavior/attribution.md).

## Open questions

1. Should the First Folio also show Hinman's Through Line Numbers (TLN), the standard for
   citing F1? Computing them reliably needs page-layout data that EEBO-TCP may not carry.
2. Alignment coverage threshold for shipping (CRP-052): proposed 100% reviewed for scene
   divisions and speaker attribution, and at least spot-checked line alignment.
