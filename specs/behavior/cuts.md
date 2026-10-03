# Cuts and text edits

Status: Approved (direction and constraints, CUT-001 – CUT-013). Detailed requirements
(CUT-020 onward): Proposed.

A **cut** is a named arrangement of a version for performance or teaching: lines or whole scenes
hidden, words changed, stage directions or narration added. Readers choose among cuts the way
they choose among versions.

## Direction

- **CUT-001** — Every version has a built-in cut **Full play**: the version unchanged. It is the
  default and cannot be edited or deleted.
- **CUT-002** — Readers create their own named cuts (e.g. "Study cut", "Class reading") and
  switch among them from the top bar.
- **CUT-003** — A cut may hide lines, speeches or scenes; replace the wording of a span; and
  insert new stage directions or narration.
- **CUT-004** — Hidden and edited text is indicated unobtrusively (to be designed), so the
  reader can always tell that, and where, the text differs from the full play, and can reveal it.
- **CUT-005** — Notes on hidden or edited text remain visible together with that indication
  (exact presentation to be iterated).
- **CUT-006** — Cuts are exported and imported like notes, as part of a collection.

## Constraints on the current design

These hold now so cuts can be added without migrating existing notes:

- **CUT-010** — Corpus text is immutable at runtime; a cut is stored as a list of operations over
  corpus text node IDs and anchors, never as a modified copy of the text.
- **CUT-011** — Notes anchor to corpus text nodes (ANC-001), so a note's anchor is the same in
  every cut of that version.
- **CUT-012** — Text inserted by a cut will be made of new text nodes with their own IDs
  (namespaced to the cut), so notes can anchor to inserted text with the same anchor model.
- **CUT-013** — The scene map and current-scene logic take their scene list and node counts
  from a "displayed document" abstraction, not directly from the corpus, so a cut can hide
  scenes and change lengths.

## Detailed requirements (Proposed)

### Choosing and managing cuts

- **CUT-020** — Next to the version in the top bar, a **cut** control MUST show the current cut
  ("Full play" by default) and list the version's cuts, then **New cut…** and **Manage cuts…**.
- **CUT-021** — **New cut…** asks for a name (required, unique per version) and opens the new cut
  in edit mode. **Manage cuts…** lists the version's cuts with their number of changes, and
  offers rename, duplicate and delete (with confirmation, PNL-026). Full play offers none of these.
- **CUT-022** — The current cut is part of the URL (`?cut=<id>`) and remembered per version
  (setting `reader.lastCut.<playId>.<versionId>`). An unknown cut ID falls back to Full play.
- **CUT-023** — A cut belongs to one version, like notes (ANC-001). Switching version switches to
  that version's last-used cut.

### Editing a cut

- **CUT-030** — With a cut other than Full play, an **Edit cut** toggle in the top bar turns edit
  mode on and off. Changes save implicitly (PNL-022) and edit mode has **Undo** for the last
  change (unlimited within the session).
- **CUT-031** — In edit mode the selection menu (SELX-002) offers, besides its usual actions:
  **Cut** (hide the selection, snapped to whole words, SELX-005), **Replace…** (new wording for
  the selection) and **Insert after…** (a new stage direction or narration after the line where
  the selection ends).
- **CUT-032** — In edit mode each scene heading offers **Cut scene** / **Restore scene**, and each
  speech offers **Cut speech**, without needing a selection.
- **CUT-033** — Activating hidden, replaced or inserted text in edit mode offers **Restore**
  (remove that change) and, for replacements and insertions, **Edit**.
- **CUT-034** — Changes MUST NOT overlap: cutting text that contains a replacement or a cut span
  merges them into one cut span; replacing text that is partly cut is not offered.

### How a cut looks

- **CUT-040** — Hidden text collapses to a small marker in the text: within a line, "⋯"; whole
  lines or speeches, a thin rule labelled "12 lines cut"; a whole scene, its heading with
  "Scene cut". Activating a marker reveals the hidden text in place (struck through and dimmed)
  until activated again.
- **CUT-041** — An overflow-menu toggle **Show cut text** reveals all hidden text at once in the
  same struck-through style (global setting `cuts.showCutText`, default off).
- **CUT-042** — Replaced text shows the new wording with a dotted outline; its original wording
  is shown on hover or focus, and inline (struck through, before the new wording) when cut text
  is shown.
- **CUT-043** — Inserted text is shown as a stage direction or narration with a leading "+" and
  the label "Added", in the style of stage directions; narration is set apart from stage
  directions by an indent.
- **CUT-044** — Notes on hidden text (CUT-005): the hidden-text marker shows a small dot when notes
  are attached, and the notes panel opens with the text revealed. Highlights on replaced text
  stay on the original span and show when it is revealed.
- **CUT-045** — The scene map, scene navigation and current-line logic use the displayed
  document (CUT-013): a cut scene keeps a thin hatched segment on the map but is skipped by
  previous/next scene; line counts shrink with hidden lines.
- **CUT-046** — Line numbers stay those of the full play (they identify lines across cuts);
  inserted text has none.

### Data

- **CUT-050** — Cuts are stored in a `cuts` store: `id`, `playId`, `versionId`, `name`, `origin`
  (STO-020), `createdAt`, `updatedAt`, `operations`. Each operation has an `id` and is one of:
  `{ type: "hide", anchor }`, `{ type: "replace", anchor, text }`,
  `{ type: "insert", after: nodeId, kind: "sd" | "narration", text }`. Anchors follow ANC-002 and
  are resolved like notes' (ANC-030); an operation whose anchor is unattached is listed in Manage
  cuts and does nothing until restored or deleted.
- **CUT-051** — An inserted node's ID is `cut:<cutId>:<operationId>` (CUT-012).
- **CUT-052** — Export (IOX) offers **Include cuts** (on by default when the play has cuts); cuts
  are written as `shakespeer-cuts.json` beside the notes in the same ZIP (XCH-001), with the same
  item-matching and tombstone rules as notes on re-import (XCH-040, XCH-041).
