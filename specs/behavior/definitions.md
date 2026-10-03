# Definitions

Status: Approved

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

- **DEF-010** — The first release MUST ship sourced definitions from Schmidt's
  _Shakespeare-Lexicon_ and Onions' _A Shakespeare Glossary_, matched to specific occurrences
  ([CRP-070](../data/corpus.md)). (Folger's downloadable texts carry no glosses, so Folger is not
  a definition source.)
- **DEF-013** — _Removed._ (Was: a link to Shakespeare's Words; dropped as that work is
  copyrighted.)
- **DEF-014** — _Planned:_ generated definitions (CRP-074) appear as one more source, always
  labeled as generated, and can be switched off like any source.
- **DEF-011** — Sourced definitions MUST be read-only and MUST NOT be deletable.
- **DEF-012** — Each source of sourced definitions MUST be individually switchable on or off in
  the reader's overflow menu ("Definition sources"). All are on by default; the setting is
  global and persisted. A term whose definitions are all switched off is not shown as a term.

## Display

- **DEF-030** — Terms are unmarked by default, for legibility. A term MUST show a dotted
  underline while the pointer hovers over it (with a pointer cursor), and all terms MUST show
  dotted underlines while underlines are revealed (DEF-034, DEF-035). Activating a term (click,
  tap, or Enter when focused) opens the panel whether or not its underline is showing.
- **DEF-031** — The panel entry for a term MUST show the quoted term and then its definitions:
  own, then imported, then sourced (grouped by source in a stable order). Each shows meaning,
  part of speech and source.
- **DEF-032** — Terms MUST be reachable without a pointer: while underlines are revealed, terms
  are focusable in document order. (Hidden terms are not tab stops, so the keyboard is not
  trapped among thousands of invisible stops; revisit with a "notes in this scene" list.)
- **DEF-033** — Where terms overlap (one inside another, or partially), the underline marks the
  union; activating any point lists every term covering that point (PNL-010).
- **DEF-034** — The reader's overflow menu MUST offer **Show definition underlines**, revealing
  all underlines while on. The setting is global, persisted, and defaults to off.
- **DEF-035** — On touch devices (no hover), a small floating button at the bottom right of the
  text MUST reveal all underlines while held, and toggle them on or off when tapped. It shows
  whether underlines are revealed and has the accessible name "Show definition underlines".

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
