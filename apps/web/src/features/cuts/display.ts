/**
 * The displayed document (CUT-013): a version as a cut shows it. Corpus text never changes
 * (CUT-010); a cut is resolved against it into hidden ranges, replacement wording and inserted
 * nodes, and a document-order index of what is displayed, for the scene map, scene navigation
 * and the current line (CUT-045).
 */
import {
  createVersionIndex,
  type Block,
  type StageDirectionNode,
  type VersionDocument,
  type VersionIndex,
} from '@shakespeer/corpus';
import type { CutOperation, CutRecord } from '@shakespeer/storage';

import { decorationsFor, resolveAnchor } from '@/features/reader/anchors';

export type HideOperation = Extract<CutOperation, { type: 'hide' }>;
export type ReplaceOperation = Extract<CutOperation, { type: 'replace' }>;
export type InsertOperation = Extract<CutOperation, { type: 'insert' }>;

/** A range of a node's text that the cut hides, by a hide or as the old wording of a replace. */
export interface HiddenRange {
  start: number;
  end: number;
  opId: string;
  type: 'hide' | 'replace';
}

/** A node added by a cut (CUT-012, CUT-051). */
export interface InsertedNode extends StageDirectionNode {
  opId: string;
  narration: boolean;
}

export interface DisplayCut {
  cutId: string;
  /** Operations found in the text (ANC-030), with repaired anchors. */
  operations: CutOperation[];
  /** Operations whose text cannot be found: they do nothing (CUT-050). */
  unattached: CutOperation[];
  hidden: ReadonlyMap<string, readonly HiddenRange[]>;
  /** Nodes wholly hidden, so not displayed. */
  hiddenNodes: ReadonlySet<string>;
  /** Replacement wording, shown where each replaced span starts. */
  replacements: ReadonlyMap<string, readonly { offset: number; op: ReplaceOperation }[]>;
  /** Nodes added after each node. */
  inserts: ReadonlyMap<string, readonly InsertedNode[]>;
  /** Scenes with every node hidden (CUT-040). */
  cutScenes: ReadonlySet<string>;
  /** Document-order index of what is displayed (CUT-013). */
  index: VersionIndex;
}

/** The ID of a node a cut inserts (CUT-051). */
export function insertedNodeId(cutId: string, opId: string): string {
  return `cut:${cutId}:${opId}`;
}

/** Checks each operation against the current text (CUT-050, ANC-030). */
export function resolveOperations(
  index: VersionIndex,
  operations: readonly CutOperation[],
): { operations: CutOperation[]; unattached: CutOperation[] } {
  const found: CutOperation[] = [];
  const unattached: CutOperation[] = [];
  for (const op of operations) {
    if (op.type === 'insert') {
      (index.node(op.after) ? found : unattached).push(op);
      continue;
    }
    const resolution = resolveAnchor(index, op.anchor);
    if (resolution.status === 'unattached') {
      unattached.push(op);
    } else {
      found.push({ ...op, anchor: resolution.anchor });
    }
  }
  return { operations: found, unattached };
}

function coversWhole(ranges: readonly HiddenRange[], length: number): boolean {
  let reached = 0;
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (range.start > reached) {
      return false;
    }
    reached = Math.max(reached, range.end);
  }
  return reached >= length;
}

/** An index over displayed nodes in which hidden nodes find the next displayed one. */
function displayIndex(
  corpus: VersionIndex,
  doc: VersionDocument,
  hiddenNodes: ReadonlySet<string>,
): VersionIndex {
  const shown = createVersionIndex(doc);
  const fallback = new Map<string, number>();
  let pending: string[] = [];
  for (const node of corpus.nodes) {
    if (hiddenNodes.has(node.id)) {
      pending.push(node.id);
      continue;
    }
    const at = shown.indexOf(node.id) ?? 0;
    for (const id of pending) {
      fallback.set(id, at);
    }
    pending = [];
  }
  for (const id of pending) {
    fallback.set(id, Math.max(0, shown.nodes.length - 1));
  }
  return {
    ...shown,
    indexOf: (nodeId) => shown.indexOf(nodeId) ?? fallback.get(nodeId),
  };
}

/** Resolves a cut against its version into what is displayed (CUT-040 – CUT-046). */
export function displayCut(
  index: VersionIndex,
  cut: Pick<CutRecord, 'id' | 'operations'>,
): DisplayCut {
  const { operations, unattached } = resolveOperations(index, cut.operations);
  const hidden = new Map<string, HiddenRange[]>();
  const replacements = new Map<string, { offset: number; op: ReplaceOperation }[]>();
  const inserts = new Map<string, InsertedNode[]>();
  for (const op of operations) {
    if (op.type === 'insert') {
      const node: InsertedNode = {
        id: insertedNodeId(cut.id, op.id),
        kind: 'sd',
        text: op.text,
        opId: op.id,
        narration: op.kind === 'narration',
      };
      inserts.set(op.after, [...(inserts.get(op.after) ?? []), node]);
      continue;
    }
    for (const [nodeId, range] of decorationsFor(index, op.anchor, op.id)) {
      hidden.set(nodeId, [
        ...(hidden.get(nodeId) ?? []),
        { start: range.start, end: range.end, opId: op.id, type: op.type },
      ]);
    }
    if (op.type === 'replace') {
      const at = op.anchor.start;
      replacements.set(at.nodeId, [
        ...(replacements.get(at.nodeId) ?? []),
        { offset: at.offset, op },
      ]);
    }
  }

  const hiddenNodes = new Set<string>();
  for (const [nodeId, ranges] of hidden) {
    const node = index.node(nodeId);
    if (node && !replacements.has(nodeId) && coversWhole(ranges, node.text.length)) {
      hiddenNodes.add(nodeId);
    }
  }

  const cutScenes = new Set<string>();
  for (const scene of index.scenes) {
    const ids = index.nodes.slice(scene.start, scene.end).map((node) => node.id);
    if (ids.length > 0 && ids.every((id) => hiddenNodes.has(id))) {
      cutScenes.add(scene.scene.id);
    }
  }

  // The displayed document: hidden nodes left out, inserted ones added after their node.
  const withInserts = (ids: readonly StageDirectionNode[] | undefined) => ids ?? [];
  const doc: VersionDocument = {
    ...index.doc,
    divisions: index.doc.divisions.map((act) => ({
      ...act,
      scenes: act.scenes.map((scene) => ({
        ...scene,
        blocks: scene.blocks.flatMap((block): Block[] => {
          const nodes = (block.type === 'speech' ? block.nodes : [block.node]).flatMap((node) => [
            ...(hiddenNodes.has(node.id) ? [] : [node]),
            ...withInserts(inserts.get(node.id)),
          ]);
          if (nodes.length === 0) {
            return [];
          }
          return block.type === 'speech'
            ? [{ ...block, nodes: nodes }]
            : nodes.map((node) => ({ type: 'sd', node: node as StageDirectionNode }));
        }),
      })),
    })),
  };

  return {
    cutId: cut.id,
    operations,
    unattached,
    hidden,
    hiddenNodes,
    replacements,
    inserts,
    cutScenes,
    index: displayIndex(index, doc, hiddenNodes),
  };
}
