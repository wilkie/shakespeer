import type { SourcedDefinition, SourcedDefinitionsFile, SourcedTerm } from '@shakespeer/corpus';

import type { Decoration } from './segments';

export interface TermEntry {
  term: SourcedTerm;
  sourceId: string;
}

export interface TermIndex {
  /** Decorations per text node, for rendering underlines (DEF-030). */
  byNode: ReadonlyMap<string, readonly Decoration[]>;
  get(termId: string): TermEntry | undefined;
}

/** Indexes sourced definition terms by the text node they sit in (CRP-070). */
export function createTermIndex(files: readonly SourcedDefinitionsFile[]): TermIndex {
  const byNode = new Map<string, Decoration[]>();
  const terms = new Map<string, TermEntry>();
  for (const file of files) {
    for (const term of file.terms) {
      const { start, end } = term.anchor;
      // Sourced terms are single words; multi-node spans arrive with own definitions.
      if (start.nodeId !== end.nodeId) {
        continue;
      }
      terms.set(term.id, { term, sourceId: file.sourceId });
      const list = byNode.get(start.nodeId) ?? [];
      list.push({ start: start.offset, end: end.offset, id: term.id });
      byNode.set(start.nodeId, list);
    }
  }
  return { byNode, get: (termId) => terms.get(termId) };
}

export type { SourcedDefinition };
