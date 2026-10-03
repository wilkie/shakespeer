# Cuts and text edits

Status: Planned — direction agreed; details to be specified after the first release.

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
