# Glossary

Status: Approved

**Play.** One of Shakespeare's works, e.g. _Hamlet_. Identified by a slug: `hamlet`,
`troilus-and-cressida`, `the-tempest`.

**Version.** One complete text of a play as it exists in a particular source: a modern edition
(the Folger text) or an original printing (a quarto or the First Folio). Each version is
displayed on its own. Identified within its play by a slug: `folger`, `q1-1603`, `q2-1604`,
`f1-1623`. Called a "witness" in textual scholarship.

**Modern version.** An edited version with modernized spelling and editorial act/scene
divisions. Initially only `folger`.

**Original version.** A diplomatic transcription of an early printing, in original spelling.

**Act, scene.** The structural divisions of a version. Original versions often lack some or all
divisions; they then use **editorial divisions** borrowed from the modern version via alignment,
marked as editorial.

**Text node.** The smallest addressable unit of a version's text, with a permanent ID: a
**line** (verse or prose) or a **stage direction**. Speaker names and line numbers are labels,
not text nodes.

**Speech.** A run of lines spoken by one speaker (or several speaking together).

**Line number.** The human-readable reference shown beside a line, e.g. `3.1.56`. Distinct from
the line's ID.

**Alignment.** Data mapping text nodes of an original version to the corresponding text nodes of
the modern version.

**Variant.** A curated, notable difference between versions at an aligned place, with a note
(e.g. _Hamlet_ 1.2.129, "sallied / solid / sullied flesh").

**Source.** Where content comes from: an edition, a transcription project, a glossary or
lexicon. Every displayed text and every sourced definition names its source and license.

**Anchor.** The stored description of a span of text that a note is attached to.

**Note.** Umbrella term for a **definition** or an **annotation**.

**Term.** A specific occurrence of a word or phrase in a version that has one or more
definitions. Terms are per occurrence: the same word elsewhere is a different term.

**Definition.** One record explaining a term: a meaning, a part of speech and a source. A term
can have many definitions.

**Sourced definition.** A definition that ships with the corpus (from Folger, Schmidt, Onions…).
Read-only.

**Annotation.** A highlighted span with a color and optional notes (Markdown), links and
citations.

**Origin.** Who a note belongs to: **corpus** (sourced definitions), **own** (created on this
device), or **imported** (from an imported collection).

**Collection.** A named set of notes for one play exchanged through export/import, e.g.
"Ms. Rivera — Period 3". Imported notes remember their collection.

**Cut.** _(Planned.)_ A named arrangement of a version's text with lines or scenes hidden,
words edited, and stage directions or narration added. "Full play" is the built-in cut that
shows the version unchanged.
