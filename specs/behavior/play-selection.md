# Play selection

Status: Approved

The entry page. A reader chooses a play here and returns here from any play.

## Requirements

- **SEL-001** — The app's home route (`/`) MUST be the play selection page.
- **SEL-002** — The page MUST list every play in the corpus ([CRP](../data/corpus.md)) with its
  title, genre (comedy, tragedy, history, romance, or "problem play" where the corpus says so) and
  approximate date of composition.
- **SEL-003** — Plays MUST be ordered by title. Grouping by genre MAY be added once the corpus
  holds enough plays to need it.
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
