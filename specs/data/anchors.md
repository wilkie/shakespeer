# Anchors

Status: Approved

An anchor records which span of text a note is attached to. Anchors must survive page reloads,
export/import between devices, corrections to the corpus, and (later) cuts.

## Model

- **ANC-001** — Every note belongs to exactly one play version and anchors to that version's
  corpus text nodes ([CRP-022](corpus.md)). Notes never anchor to rendered DOM, line numbers, or
  cut-specific positions (CUT-011).
- **ANC-002** — An anchor MUST have this shape:

  ```ts
  interface TextAnchor {
    start: { nodeId: string; offset: number }; // inclusive
    end: { nodeId: string; offset: number }; // exclusive
    quote: { exact: string; prefix: string; suffix: string };
    revision: string; // the version's corpus revision when the anchor was made (CRP-025)
  }
  ```

  Offsets count UTF-16 code units in the node's `text`. `start` precedes or equals `end` in
  document order. `exact` is the anchored text, with nodes joined by a single newline. `prefix`
  and `suffix` hold up to 32 characters of the surrounding text, for repair (ANC-031). This
  follows the W3C Web Annotation model (TextPositionSelector plus TextQuoteSelector).

- **ANC-003** — Document order is defined by each node's position in the version (acts, scenes,
  blocks, nodes in sequence). The corpus loader MUST expose each node's sequence index so ranges
  can be compared as `(index, offset)` pairs.
- **ANC-004** — A span MAY cross nodes, speeches and scenes (SELX-003); an anchor MUST NOT be
  empty.

## Identity and comparison

- **ANC-010** — Two anchors are **equal** when their `start` and `end` are equal (the quote is
  not compared). Equal anchors make one term (DEF-020).
- **ANC-011** — An anchor **covers** a character `(nodeId, i)` when `start ≤ (index, i) < end`.
  The panel lists notes covering the activated character (PNL-010).

## Creating anchors

- **ANC-020** — Rendered text MUST carry each node's ID on its element, and its rendered
  characters MUST equal the node's `text` exactly, so DOM selection boundaries convert to
  `(nodeId, offset)` without guessing. Labels (speaker names, line numbers) are outside node
  elements.
- **ANC-021** — Conversion from a DOM selection MUST apply word snapping and trimming (SELX-005)
  on the corpus text, not the DOM.

## Resolving anchors

- **ANC-030** — When a version loads, every anchor of its notes MUST be checked: the text between
  `start` and `end` must equal `quote.exact`. If it does, the anchor is **valid**.
- **ANC-031** — If not (corpus corrected, or nodes replaced, CRP-024), the app MUST try to
  **repair** it: search for `quote.exact` first in the nodes listed in `replaces` maps and the
  original scene, then in the whole version; pick the unique match whose prefix and suffix agree
  best. A repaired anchor is saved with the current `revision`.
- **ANC-032** — If repair finds no unique match, the note is **unattached**: kept in storage,
  not shown in the text, and listed under "Unattached notes" in the overflow menu, where it can
  be viewed, deleted, or attached to the current selection ("Attach to selection").
- **ANC-033** — Resolution MUST NOT block first render of the text: notes appear as soon as
  they are resolved.

## Open questions

1. Should anchors use code points instead of UTF-16 code units? UTF-16 matches JavaScript string
   indexing; the corpus is almost entirely in the Basic Multilingual Plane, so the difference is
   theoretical. Proposed: UTF-16.
