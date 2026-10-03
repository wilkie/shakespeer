# Definitions

Status: Draft

A definition explains a word or phrase **at one occurrence**. Meanings depend on context (puns,
period senses, wordplay), so a definition never spreads to other occurrences of the same word.

## Model (as the reader sees it)

- **DEF-001** — A **term** is one occurrence of a word or phrase in one version, identified by
  its anchor ([ANC](../data/anchors.md)). A term has one or more **definitions**.
- **DEF-002** — A definition MUST have a **meaning** (plain text, required) and MAY have a
  **part of speech** (from a fixed list: noun, verb, adjective, adverb, pronoun, preposition,
  conjunction, interjection, phrase, other) and a **source** (free text such as "OED" or "my
  teacher" for own definitions; a corpus source for sourced definitions, ATR-010).
- **DEF-003** — Definitions come from three origins: sourced (shipped with the corpus), own,
  and imported. A term MAY mix all three.

## Sourced definitions

- **DEF-010** — The first release MUST ship sourced definitions from the Folger edition's
  glosses (if their license and format permit) and from Schmidt's _Shakespeare-Lexicon_ and
  Onions' _A Shakespeare Glossary_, matched to specific occurrences ([CRP-070](../data/corpus.md)).
- **DEF-011** — Sourced definitions MUST be read-only and MUST NOT be deletable.
- **DEF-012** — Each source of sourced definitions MUST be individually switchable on or off in
  the reader's overflow menu ("Definition sources"). All are on by default; the setting is
  global and persisted. A term whose definitions are all switched off is not shown as a term.

## Display

- **DEF-030** — Every term with at least one visible definition MUST be marked in the text with
  a dotted underline. Activating it (click, tap, or Enter when focused) opens the panel.
- **DEF-031** — The panel entry for a term MUST show the quoted term and then its definitions:
  own, then imported, then sourced (grouped by source in a stable order). Each shows meaning,
  part of speech and source.
- **DEF-032** — Terms MUST be reachable without a pointer: terms are focusable in document
  order. (Too many tab stops is acceptable for now; revisit with a "notes in this scene" list.)
- **DEF-033** — Where terms overlap (one inside another, or partially), the underline marks the
  union; activating any point lists every term covering that point (PNL-010).

## Creating and editing

- **DEF-020** — **Add definition** on a selection whose anchor equals an existing term's anchor
  (same start and end, ANC-010) MUST add to that term rather than create a parallel term.
- **DEF-021** — In edit mode, the term's entry MUST offer an **Add definition** button that
  appends a blank own definition and focuses its meaning field.
- **DEF-022** — Own and imported definitions MUST be editable in edit mode (meaning, part of
  speech, source) and each MUST have a **Delete** button (with confirmation, PNL-026).
- **DEF-023** — Deleting the last own/imported definition of a term with no sourced definitions
  removes the term (and its underline).
- **DEF-024** — Editing an imported definition MUST mark it as locally modified (XCH-040); it
  keeps its collection.

## Open questions

1. Should a reader be able to see "other occurrences of this word" (a concordance) from a term?
   Not in the first release; noted as a likely request.
