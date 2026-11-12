# Scholarship

Status: Approved

Links from lines of a play to scholarly works that quote them: articles, chapters, books and
dissertations found in [OpenAlex](https://openalex.org)'s full-text index. Two ways in: a
committed **snapshot** per play, gathered offline by a maintainer and shipped like a source, and
a **live lookup** a reader runs on a selection from the reader. Both show the same kind of entry
in the panel. An experiment on _The Tempest_ (every line looked up) found citing works for 75% of
its lines, 1,620 works in all, with 83% of them linking to an open-access copy.

## Which works

- **SCH-001** — A work **quotes** a line when OpenAlex's full-text search finds the line's
  **phrase** as an exact phrase in the work. A line's phrase is its words, without punctuation,
  joined with the following lines of the same speech until it has at least 6 words, and cut at
  12 words. A line that cannot reach 6 words within its speech has no phrase and is not looked up.
- **SCH-002** — Only works whose primary topic is in the field "Arts and Humanities" are kept, so
  that a medical paper titled with a famous line is not listed.
- **SCH-003** — A work quoting a quarter or more of a version's lines reprints the play rather
  than discussing it (an edition, an acting version) and is dropped. Records OpenAlex holds more
  than once for the same work (same title, ignoring case and punctuation) are merged.
- **SCH-004** — Each work records: its OpenAlex ID, title, authors (as listed), year, venue, type
  (article, book chapter, book, dissertation, review…), DOI, and its open-access URL if any.
  Nothing from the work's text is stored or shown.

## The snapshot

- **SCH-010** — A maintainer gathers a play's snapshot by hand (CRP-006):
  `pnpm --filter @shakespeer/corpus find-scholarship --play <playId> [--from <line> --to <line>]`.
  It looks up each line of the modern version (SCH-001), with an OpenAlex API key from the
  environment, never the repository, and writes a curation file. It saves as it goes and, re-run,
  only looks up lines without an answer.
- **SCH-011** — The curation file is `curation/<playId>/scholarship/<versionId>.json`:
  `{ retrievedAt, queryVersion, lines, works, rejected }`. `lines` maps each looked-up line's ID
  to the IDs of the works quoting it (empty when none); `works` holds each work (SCH-004) once;
  `rejected` lists work IDs a person has removed, which never ship. The filters of SCH-002 and
  SCH-003 are applied by ingest, so changing them needs no new lookups.
- **SCH-012** — Ingest writes `scholarship/<versionId>.json` for the play: per line, its citing
  works in the order of SCH-021, and the works. The source registry (CRP-080) gains an `openalex`
  entry (OpenAlex metadata is CC0 1.0) whose description names the retrieval date.
- **SCH-013** — Snapshots cover the modern version only, as generated definitions do (GEN-003).

## In the reader

- **SCH-020** — The selection menu (SELX-002) MUST offer **Scholarship**, which opens the panel
  with the works quoting any line the selection touches. A line with snapshot works also shows a
  small mark in its margin when **Show scholarship marks** (setting `scholarship.showMarks`,
  default off) is on; activating the mark opens the same panel for that line.
- **SCH-021** — Each work in the panel MUST show its title (linked to its open-access copy, else
  its DOI, else its OpenAlex page), its authors (the first three, then "et al."), year, venue and
  type, and which of the selected lines it quotes. Works quoting more of the selection come first,
  then the most recent. The panel shows 20 at first, with **Show all**.
- **SCH-022** — The panel MUST say where the list comes from: "From OpenAlex, retrieved <date>",
  linked to the source (ATR-010), and that only works whose full text OpenAlex holds can be found
  (mostly open-access work).
- **SCH-023** — "Scholarship" appears under the overflow menu's sources (DEF-012) and can be
  switched off; off, neither marks nor snapshot works are shown.

## Live lookup

- **SCH-030** — The panel MUST offer **Search OpenAlex now**, which looks up the selection's
  lines (SCH-001) from the reader's browser, applying SCH-002 and SCH-003 (works the snapshot
  dropped as reprints stay dropped), and lists works not already shown under "New from OpenAlex".
  It works on any version: for an original version, the lines looked up are the modern lines it
  aligns to.
- **SCH-031** — A live lookup MUST happen only when the reader asks for it. It sends only the
  phrases of the selected lines to `api.openalex.org`, with no key and nothing identifying the
  reader; the About & licenses page (ATR-020) says so. At most 20 lines are looked up per request.
- **SCH-032** — Live results are not stored. The reader can keep one by **Cite in a note**, which
  adds it as a citation to an annotation on the line (ANN), created if there is none.
- **SCH-033** — When the lookup fails, the panel MUST say why in plain words: offline, OpenAlex's
  daily limit reached (shared by everyone on the same network; resets at midnight UTC), or another
  error, with **Try again**.

## Decisions

1. The snapshot ships without a review gate: the links point to real works and false matches
   were rare in the experiment (about 1 in 10 on the least quoted lines); `rejected` removes any
   a person reports.
2. Talks and lectures are out of scope: there is no open index of their transcripts.
3. **Cite in a note** (SCH-032) is part of the first version.
