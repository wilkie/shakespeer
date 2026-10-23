# Play selection

Status: Approved

The entry page. A reader chooses a play here and returns here from any play.

## Requirements

- **SEL-001** — The app's home route (`/`) MUST be the play selection page.
- **SEL-002** — The page MUST list every play in the corpus ([CRP](../data/corpus.md)) with its
  title and approximate date of composition. It shows no genre: the categories (the First
  Folio's comedies, histories and tragedies, or later critics' "romances" and "problem plays")
  are disputed.
- **SEL-003** — Plays MUST be ordered by title.
- **SEL-004** — Each play entry MUST list its available versions by display name (e.g. "Folger
  edition", "First Quarto (1603)") so a reader knows which printings exist.
- **SEL-005** — Choosing a play MUST open it in the reader ([RDR](reader.md)) at the reader's
  saved position for that play, or at the start if there is none (see RDR-030).
- **SEL-006** — A play entry SHOULD show a small count of the reader's own and imported notes for
  that play, so plays already in use are easy to spot.
- **SEL-007** — The page MUST be fully usable on a phone in portrait orientation: entries stack
  in a single column with touch targets at least 44 × 44 CSS px.

## Open questions

1. Should choosing a play open the version last used for it, or always the Folger edition?
   Proposed: last used (RDR-041).
