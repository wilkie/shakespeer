# Text selection

Status: Draft

Selecting text is how notes are created.

## Requirements

- **SELX-001** — Selection MUST use the platform's native text selection (mouse drag, double
  click, keyboard, touch handles). The app does not replace it.
- **SELX-002** — When a non-empty selection lies within the play text, a selection menu MUST
  appear with two actions: **Add definition** and **Add annotation**.
- **SELX-003** — A selection MAY span lines, speeches, speakers and stage directions within one
  version. It MUST NOT span outside the play text (top bar, panel, map).
- **SELX-004** — Speaker names, line numbers and scene headings MUST NOT be part of a selection
  (rendered with `user-select: none`). If a selection begins or ends on them, it is trimmed to the
  nearest text node.
- **SELX-005** — When an action is chosen, the selection MUST be snapped outward to whole words
  (a partial word becomes the whole word) and trimmed of leading and trailing whitespace and
  punctuation, then converted to an anchor ([ANC](../data/anchors.md)).
- **SELX-006** — **Add definition** opens the panel ([PNL](side-panel.md)) for the term at
  exactly that anchor: the existing term if one exists (DEF-020), otherwise a new term, in edit
  mode with a new blank definition focused.
- **SELX-007** — **Add annotation** creates an annotation immediately with the most recently used
  color (ANN-011), clears the selection, and opens it in the panel in edit mode with the notes
  field focused.
- **SELX-008** — On pointer devices the menu MUST appear next to the end of the selection, above
  it if there is room and below otherwise, without covering the selected text.
- **SELX-009** — On touch devices the menu MUST appear below the selection, clear of the
  operating system's own selection callout (which appears above), and MUST stay positioned while
  selection handles are dragged.
- **SELX-010** — The menu MUST disappear when the selection is cleared or collapsed, on scroll
  away, or on Escape.
- **SELX-011** — The menu MUST be keyboard accessible: with a selection made by keyboard,
  pressing the context-menu key or `Shift+F10` focuses the menu.
- **SELX-012** — Copying selected text MUST keep working and copy plain text with line breaks
  between lines.

## Open questions

1. Should whole-word snapping apply to annotations too, or only to definitions? Proposed: both,
   for predictability; a reader who wants a single letter highlighted is rare.
