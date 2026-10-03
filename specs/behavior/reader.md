# Reader

Status: Draft

The play page: the full text of one version of one play, with a top bar, the scene map on the
right ([MAP](scene-map.md)) and the notes panel on the left ([PNL](side-panel.md)).

## Route and layout

- **RDR-001** — The reader route MUST be `/plays/:playId/:versionId`. `/plays/:playId` MUST
  redirect to the version chosen by RDR-041. Unknown play or version IDs show the not-found page.
- **RDR-002** — The page MUST show, from top to bottom: the top bar, then the play text as a
  single continuous scroll. The scene map is fixed at the right edge of the viewport; the notes
  panel opens from the left (or bottom; see PNL-003).
- **RDR-003** — The text column MUST have a comfortable reading measure (roughly 60–75
  characters for prose) and stay centered in the space between panel and map.

## Top bar

- **RDR-010** — The top bar MUST stay visible while the text scrolls.
- **RDR-011** — The top bar's first (top-left) control MUST navigate to play selection. It is an
  icon button labeled "All plays" for assistive technology and in its tooltip.
- **RDR-012** — The top bar MUST show the play title and the current version's display name.
- **RDR-013** — The top bar MUST provide a version switcher listing the play's versions
  (RDR-040).
- **RDR-014** — Further actions (export, import, display settings, source information) MUST live
  in a single overflow menu at the right end of the top bar until a later spec defines the
  action set.
- **RDR-015** — On narrow screens the play title MAY truncate with an ellipsis; the back control
  and overflow menu MUST NOT be hidden.
- **RDR-016** — Below the `md` breakpoint the top bar MUST slide out of view while the reader
  scrolls down and slide back on any upward scroll, at the top of the play, and whenever the
  notes panel or a menu opens. The compact scene control (MAP-051) moves with it. Above `md`
  the top bar is always visible.

## The text

- **RDR-020** — The whole version MUST be rendered as one scrolling document: every act, scene,
  speech, line and stage direction, in order. The reader never pages or loads scene by scene.
- **RDR-021** — Each scene MUST begin with a heading "Act N, Scene M" (with "editorial" styling
  for editorial divisions, see CRP-031), followed by its text.
- **RDR-022** — Each speech MUST show its speaker name(s) as given by the version, visually
  distinct from the spoken text.
- **RDR-023** — Verse lines MUST be displayed one per row and never re-flowed; long verse lines
  wrap with a hanging indent. Prose MUST flow as paragraphs, but each prose line remains its own
  text node (CRP-020) so notes and line numbers keep working.
- **RDR-024** — A verse line shared between speakers (split line) MUST be indented so each part
  continues where the previous part ended, as in printed editions.
- **RDR-025** — Stage directions MUST be visually distinct (italic, set apart) and be part of
  the selectable, annotatable text.
- **RDR-026** — Line numbers MUST be shown in the margin every fifth line, using the version's
  numbering (CRP-040). Speaker names and line numbers MUST NOT be selectable text (SELX-004).
- **RDR-027** — Rendering MUST stay smooth (no dropped frames while scrolling on a mid-range
  phone) for the longest version in the corpus. The implementation SHOULD keep the whole
  document in the DOM (so browser find-in-page and long selections work) and use
  `content-visibility: auto` per scene rather than list virtualization.
- **RDR-028** — Text MUST use the theme's reading typeface and respect the reader's browser
  font-size settings.

## Current scene and reading position

- **RDR-030** — The **current line** is the first text node whose top edge is at or below the
  bottom of the top bar (or the top of the viewport while the top bar is hidden, RDR-016). The **current scene** is the scene containing the current line. Only
  the current scene drives the scene map (MAP-010).
- **RDR-031** — The URL fragment MUST track the current line as `#<line number>` (e.g.
  `#3.1.56`), updated with `history.replaceState` at most every 250 ms while scrolling. Scrolling
  MUST NOT add browser history entries.
- **RDR-032** — Opening a reader URL with a fragment MUST scroll so that line is the current
  line. A fragment naming only a scene (`#3.1`) scrolls to the scene heading.
- **RDR-033** — The reading position (current line) MUST be saved per play and version
  ([STO](../data/storage.md)) and restored when the reader opens that version without a fragment.
- **RDR-034** — Restoring a position MUST NOT animate; it appears already scrolled.
- **RDR-035** — The browser Back button from the reader MUST return to play selection (or
  wherever the reader came from), never to an earlier scroll position.

## Versions

- **RDR-040** — Switching version MUST keep the reader at the corresponding place: the current
  line is mapped through alignment ([CRP](../data/corpus.md), CRP-050) to the other version. If
  the line has no counterpart, the reader goes to the nearest preceding aligned line, or else to
  the start of the corresponding scene.
- **RDR-041** — `/plays/:playId` MUST open the version last used for that play, defaulting to
  the modern version.
- **RDR-042** — Notes belong to one version (ANC-001). When a version is displayed, only its
  notes are shown. The version switcher SHOULD show how many notes each version has.
- **RDR-043** — _Later:_ inline variant marks and a side-by-side comparison view. Not part of
  the first release; the corpus already carries the data (CRP-060).

## Responsive behavior

- **RDR-050** — The reader MUST be fully usable on a phone in portrait orientation, including
  selecting text and creating, viewing and editing notes.
- **RDR-051** — Breakpoints follow the MUI theme: below `md` (900 px) the notes panel becomes a
  bottom sheet (PNL-003) and the scene map becomes compact (MAP-050).

## Open questions

1. Line numbers every fifth line, or every line on hover/focus as well? Proposed: every fifth,
   plus the number of any line under the pointer or containing the selection.
