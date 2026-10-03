# Annotations

Status: Draft

An annotation works like a paper highlighter: a colored span of text, optionally carrying notes,
links and citations.

## Content

- **ANN-001** — An annotation MUST have an anchor (ANC) and a color, and MAY have: notes
  (Markdown), links, and citations.
- **ANN-002** — Notes MUST be written in Markdown (CommonMark plus GitHub tables, strikethrough
  and autolinks). Rendering MUST be sanitized: no raw HTML, no scripts, no images from remote
  URLs; links open in a new tab with `rel="noopener noreferrer"`.
- **ANN-003** — A link MUST have a URL (http or https only) and MAY have a label; without a
  label the URL's host and path are shown.
- **ANN-004** — A citation MUST be stored as structured fields: type (book, chapter, article,
  web page, other), title, authors (each with family and given names, or a literal name), date,
  container (journal or book title), publisher, place, volume, issue, pages, URL, DOI, and a
  free-text note. Only title is required. (The storage and file form is a subset of CSL-JSON, the format used by Zotero and citation tools; STO-011, XCH-002.)
- **ANN-005** — The citation editor MUST accept pasted **BibTeX** and **RIS** (the formats
  digital libraries and reference managers export) and fill the fields from it. Several entries
  pasted at once create several citations. The editor MAY also accept CSL-JSON.
- **ANN-006** — Citations MUST be displayed in a consistent, readable style (author, title,
  container, date, pages, linked DOI/URL). A specific academic style (MLA, Chicago) MAY be
  offered later.

## Colors

- **ANN-010** — Colors MUST come from a fixed palette of six, in this order: yellow, green,
  blue, pink, orange, purple. Each has a light-mode and dark-mode value chosen so text stays
  readable (WCAG AA contrast for the text on the highlight) and colors stay distinguishable.
- **ANN-011** — New annotations use the most recently chosen color, initially yellow. The choice
  is persisted.
- **ANN-012** — Colors MUST NOT be the only way to tell annotations apart in the panel; each
  entry also shows its quoted text and the color's name to assistive technology.

## Display

- **ANN-020** — The anchored text MUST be shown with a background highlight in the annotation's
  color. Activating it opens the panel.
- **ANN-021** — Where annotations overlap, the overlapping text MUST show both colors in a way
  that remains readable (the later annotation's color striped over the earlier's, or a blended
  tint; to be settled in design review). Activating it lists all of them (PNL-010).
- **ANN-022** — An annotation with notes, links or citations SHOULD show a small marker at the
  end of its span so readers can tell bare highlights from highlights with content.
- **ANN-023** — Highlights MUST be visible in both light and dark mode and in Windows High
  Contrast / forced-colors mode (where they fall back to an outline).

## Editing

- **ANN-030** — In edit mode the panel entry MUST provide: a color picker (the palette as
  swatches), a Markdown editor with Write/Preview tabs, a list editor for links, a list editor
  for citations (with "Paste BibTeX/RIS"), and a **Delete annotation** button (PNL-026).
- **ANN-031** — Own and imported annotations are both fully editable. Editing an imported
  annotation marks it locally modified (XCH-040).

## Open questions

1. Should the anchored span of an existing annotation be adjustable (drag its ends)? Proposed:
   later; for now delete and recreate.
