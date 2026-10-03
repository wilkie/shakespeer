# Scene map

Status: Approved

A vertical bar at the right edge of the reader showing the whole play as a column of scenes,
with a previous-scene button above it and a next-scene button below it.

## Structure

- **MAP-001** — The map MUST occupy the full height between the top bar and the bottom of the
  viewport, at the right edge, and stay fixed while the text scrolls.
- **MAP-002** — From top to bottom it contains: the previous-scene button, the scene bar, the
  next-scene button.
- **MAP-003** — The scene bar MUST divide its height among the version's scenes in proportion to
  each scene's length, measured in text nodes (CRP-022). It MUST NOT depend on rendered heights,
  so it is correct before layout completes.
- **MAP-004** — Each scene segment MUST be visibly separated from its neighbors; act boundaries
  MUST be more prominent than scene boundaries.
- **MAP-005** — Each segment MUST have an accessible name ("Act 3, Scene 1") and a tooltip with
  the same text. Segments too small to show a label MUST still have the tooltip.

## Tracking the reader

- **MAP-010** — The current scene's segment (RDR-030) MUST be highlighted.
- **MAP-011** — A viewport indicator MUST show which part of the play is on screen, positioned
  by the text nodes at the top and bottom of the viewport (so it matches MAP-003's scale).
- **MAP-012** — Highlight and indicator MUST update continuously while scrolling, without
  layout thrashing (computed from cached node positions or an `IntersectionObserver`, not by
  measuring every node per frame).

## Navigation

- **MAP-020** — Activating a scene segment MUST scroll to that scene's heading.
- **MAP-021** — Dragging along the scene bar (pointer or touch) SHOULD scrub through the play,
  scrolling to the corresponding position continuously.
- **MAP-022** — The previous-scene button MUST be labeled with the act and scene it will go to
  (e.g. "Act 2, Scene 2"). If the current line is not the first line of the current scene, the
  button goes to the start of the current scene and is labeled with the current scene;
  otherwise it goes to the start of the previous scene.
- **MAP-023** — The next-scene button MUST be labeled with the next scene and go to its start.
- **MAP-024** — In the first scene (at its start) the previous button, and in the last scene the
  next button, MUST be disabled but remain visible so the layout does not shift.
- **MAP-025** — Scene navigation MUST use instant scrolling when the reader has requested reduced
  motion (`prefers-reduced-motion`), and MAY use smooth scrolling otherwise.

## Annotation marks

- **MAP-040** — The map MUST be able to show annotation marks: small marks along the right edge
  of the scene bar, in each annotation's color ([ANN](annotations.md)).
- **MAP-041** — A mark MUST be placed at the annotation's position within the play on the same
  proportional scale as MAP-003 (by the index of its first text node).
- **MAP-042** — Where marks of several colors fall at the same position (closer than the mark
  height), that spot MUST be subdivided horizontally into equal-width stripes, one per color,
  ordered by the palette order (ANN-010).
- **MAP-043** — Activating a mark MUST scroll to the annotation and open it in the panel.
- **MAP-044** — Marks MUST be toggleable from the reader's overflow menu ("Show annotation marks
  on map"). The setting is global, persisted, and defaults to on.
- **MAP-045** — Definitions do not appear on the map.

## Phones

- **MAP-050** — Below the `md` breakpoint the map MUST shrink to a narrow strip (about 16 CSS px)
  that still shows scene segments, the current scene, the viewport indicator and annotation
  marks, and supports scrubbing (MAP-021).
- **MAP-051** — Below `md`, the previous/next scene buttons MUST move out of the strip into a
  compact control that appears with the top bar (RDR-016), showing the current scene
  name between them. Tapping the scene name opens a scene list for direct navigation.

## Open questions

1. Should scene segments show labels inside the bar when tall enough ("3.1")? Proposed: yes,
   when the segment is at least 20 px tall.
