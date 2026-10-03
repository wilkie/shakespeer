# Side panel

Status: Draft

The panel where notes are read and edited. It opens on the left on wide screens and as a bottom
sheet on phones.

## Opening and layout

- **PNL-001** — The panel MUST open when the reader activates a defined term (DEF-030), an
  annotation highlight (ANN-020), an annotation mark on the map (MAP-043), or a selection-menu
  action (SELX-006, SELX-007).
- **PNL-002** — At `md` and wider the panel MUST open on the left as a persistent column (about
  360 CSS px) that narrows the text area rather than covering it, and keeps the activated text in
  view.
- **PNL-003** — Below `md` the panel MUST be a bottom sheet that opens at about half the
  viewport height and can be dragged to full height or dismissed. The text MUST scroll so the
  activated text sits above the sheet.
- **PNL-004** — The panel MUST have a close button and close on Escape. Closing returns focus to
  the text that opened it.
- **PNL-005** — Activating other text while the panel is open MUST replace its contents.

## What it shows

- **PNL-010** — The panel MUST show every note covering the activated point: all terms
  (DEF-031) and all annotations (ANN-021) whose anchors include the clicked or tapped character.
  Terms are listed first, then annotations in document order.
- **PNL-011** — Each entry MUST quote the text it is attached to (truncated with an ellipsis
  after about 80 characters) and show its origin: own, imported (with the collection name), or
  the corpus source (ATR-010).
- **PNL-012** — If only one note covers the point, it MUST be shown expanded; with several, each
  is a collapsible section, all expanded when there are at most three.

## View and edit modes

- **PNL-020** — The panel MUST open in view mode, except when opened from the selection menu
  (edit mode, SELX-006/007).
- **PNL-021** — An **Edit** toggle in the panel header MUST switch all editable entries in the
  panel to edit mode and back. Sourced (corpus) definitions are never editable.
- **PNL-022** — Changes MUST save implicitly: each change is written to storage within 500 ms
  of the last keystroke (and immediately on leaving a field), with no Save button.
- **PNL-023** — While in edit mode, a **Cancel** action MUST revert every entry in the panel to
  its state when edit mode was entered, including deleting notes created during this edit
  session. After Cancel the panel returns to view mode (or closes, if nothing remains).
- **PNL-024** — Leaving edit mode by the Edit toggle, closing the panel, or navigating away
  keeps the changes.
- **PNL-025** — A note whose content is empty when edit mode ends (a definition with no meaning,
  an annotation with nothing but a color is _not_ empty) MUST be discarded, so abandoned "Add
  definition" actions leave nothing behind.
- **PNL-026** — Deleting a note MUST ask for confirmation in a dialog naming what will be
  deleted. Deletion is not undone by Cancel (PNL-023).
- **PNL-027** — A small status line MUST indicate saving state ("Saving…", "Saved", or an error
  with a retry action if storage fails).

## Open questions

1. Should Cancel be available after leaving edit mode (an "Undo" toast for a few seconds)?
   Proposed: no for now; Cancel exists only during edit mode.
