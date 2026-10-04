# Variants and comparison

Status: Approved

How the reader sees where the versions of a play differ: marks on the curated variants
([CRP-060](../data/corpus.md)) in the text, and a comparison view that shows two versions side
by side, row by row, through alignment ([CRP-050](../data/corpus.md)). This details
[RDR-043](reader.md).

## Variant marks

- **VAR-001** — In every version of a play that has variants, each variant's reading in that
  version MUST be marked in the text: a small "◇" in the left margin beside the first line of
  the reading, and, when the marker is hovered or focused, a dashed outline around the reading's
  span. Marks never change the text or its character offsets (ANC-020).
- **VAR-002** — Where a version lacks a passage that other versions have (its reading is empty,
  CRP-060), a mark MUST show where the passage would be, as a thin line between the surrounding
  lines labelled with what is missing, e.g. "F1 has 12 lines here" or "Q2 and F1 have 3 lines
  here". Its place comes from alignment: after the text aligned with what precedes the passage
  in the modern version.
- **VAR-003** — The overflow menu MUST offer **Show variant marks** (setting
  `variants.showMarks`, default on). Turned off, VAR-001 and VAR-002 marks are not shown.
- **VAR-004** — Activating a mark MUST open the notes panel (PNL-001) with the variant: its
  title, its note (Markdown, if any), where the observation comes from (ATR-010), and each
  version's reading labelled with the version's short name, an absent passage shown as "Not in
  this version". Each reading of another version offers **Open in <version>**, which switches to
  that version at the reading (RDR-040).
- **VAR-005** — Where variant marks and other notes cover the same text, the panel lists the
  variant after the notes (PNL-010).

## Comparison view

- **VAR-020** — The overflow menu MUST offer **Compare with…**, listing the play's other
  versions. Choosing one shows the comparison view; the top bar then shows
  "Compared with <version> ✕", and ✕ (or Escape outside dialogs and menus) ends it. The
  comparison is part of the URL (`?compare=<versionId>`) and is not remembered once ended.
- **VAR-021** — At `md` and wider the view MUST show the current version and the compared
  version in two columns, row by row: each row holds text that corresponds, as aligned through
  the modern version (comparing two original versions composes their alignments). Text with no
  counterpart has an empty cell opposite it. Rows follow the current version's order; compared
  text that comes elsewhere in its own version (moved, or Q1 _Hamlet_'s other scene order) is
  labelled with its own scene, e.g. "In Q1: 2.2b".
- **VAR-022** — Below `md` the comparison MUST show each row's two texts one above the other,
  the compared text in smaller type with its version's short name.
- **VAR-023** — Within a row whose texts differ, the words that differ MUST be highlighted.
  Words are compared after spelling normalization (the aligner's: u/v, i/j, long s, case and
  punctuation), so spelling alone does not count as a difference; a toggle **Show spelling
  differences** (off by default, not remembered) compares exact words instead.
- **VAR-024** — The current version's column is the ordinary reader: notes, selection, the scene
  map, current line and URL fragment all follow it. The compared column is read-only text without
  notes or marks.
- **VAR-025** — Cuts do not apply in the comparison view: both versions are shown in full, and
  the cut control is hidden while comparing.
- **VAR-026** — Comparing is offered only between versions of the same play, and is unavailable
  for a play with a single version.

## Decisions

1. Variant marks appear in every play with seeded variants: all three plays have them from the
   Folger markup (_Hamlet_ 502, _Troilus and Cressida_ 518, _The Tempest_ 171).
