/**
 * Everything attached to a version's text: sourced terms, the reader's definitions and
 * annotations, resolved against the current text and indexed for rendering and lookup.
 */
import type {
  SourcedDefinitionsFile,
  SourcedTerm,
  TextAnchor,
  VersionIndex,
} from '@shakespeer/corpus';
import type { AnnotationRecord, DefinitionRecord } from '@shakespeer/storage';

import { anchorKey, decorationsFor } from '@/features/reader/anchors';
import type { Decoration } from '@/features/reader/segments';

/** Decoration IDs carry their kind: a term (by anchor) or an annotation (by ID). */
export const TERM_PREFIX = 't:';
export const ANNOTATION_PREFIX = 'a:';

/** A term: every definition, sourced or not, attached to one span (DEF-001, ANC-010). */
export interface TermGroup {
  key: string;
  anchor: TextAnchor;
  sourced: { sourceId: string; term: SourcedTerm }[];
  definitions: DefinitionRecord[];
}

export interface NoteIndex {
  /** Decorations per text node (DEF-030, ANN-020). */
  byNode: ReadonlyMap<string, readonly Decoration[]>;
  term(key: string): TermGroup | undefined;
  annotation(id: string): AnnotationRecord | undefined;
  readonly annotations: readonly AnnotationRecord[];
}

export function createNoteIndex(
  index: VersionIndex,
  sourced: readonly SourcedDefinitionsFile[],
  definitions: readonly DefinitionRecord[],
  annotations: readonly AnnotationRecord[],
): NoteIndex {
  const terms = new Map<string, TermGroup>();
  const group = (anchor: TextAnchor): TermGroup => {
    const key = anchorKey(anchor);
    let entry = terms.get(key);
    if (!entry) {
      entry = { key, anchor, sourced: [], definitions: [] };
      terms.set(key, entry);
    }
    return entry;
  };
  for (const file of sourced) {
    for (const term of file.terms) {
      group(term.anchor).sourced.push({ sourceId: file.sourceId, term });
    }
  }
  for (const definition of definitions) {
    group(definition.anchor).definitions.push(definition);
  }

  const byNode = new Map<string, Decoration[]>();
  const add = (anchor: TextAnchor, id: string) => {
    for (const [nodeId, decoration] of decorationsFor(index, anchor, id)) {
      const list = byNode.get(nodeId) ?? [];
      list.push(decoration);
      byNode.set(nodeId, list);
    }
  };
  for (const term of terms.values()) {
    add(term.anchor, TERM_PREFIX + term.key);
  }
  const annotationsById = new Map(annotations.map((a) => [a.id, a]));
  for (const annotation of annotations) {
    add(annotation.anchor, ANNOTATION_PREFIX + annotation.id);
  }

  return {
    byNode,
    term: (key) => terms.get(key),
    annotation: (id) => annotationsById.get(id),
    annotations,
  };
}
