import type { VersionIndex } from '@shakespeer/corpus';
import {
  listNotes,
  subscribeNotes,
  updateAnchor,
  type AnnotationRecord,
  type DefinitionRecord,
  type NoteKind,
} from '@shakespeer/storage';
import { useEffect, useState } from 'react';

import { resolveAnchor } from '@/features/reader/anchors';
import { getDatabase } from '@/lib/storage';

export interface UnattachedNote {
  kind: NoteKind;
  record: DefinitionRecord | AnnotationRecord;
}

export interface VersionNotesState {
  definitions: DefinitionRecord[];
  annotations: AnnotationRecord[];
  /** Notes whose text could not be found (ANC-032). */
  unattached: UnattachedNote[];
  loaded: boolean;
}

const EMPTY: VersionNotesState = {
  definitions: [],
  annotations: [],
  unattached: [],
  loaded: false,
};

/**
 * The reader's notes for a version, resolved against the current text (ANC-030 – ANC-033):
 * valid anchors are used as stored, repaired ones are saved, unattached notes are set aside.
 * Reloads whenever notes change, in this tab or another (STO-004).
 */
export function useVersionNotes(
  playId: string,
  versionId: string,
  index: VersionIndex,
): VersionNotesState {
  const [state, setState] = useState<VersionNotesState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const db = await getDatabase();
      const notes = await listNotes(db, playId, versionId);
      const unattached: UnattachedNote[] = [];
      const repairs: Promise<void>[] = [];
      const resolve = <T extends DefinitionRecord | AnnotationRecord>(
        kind: NoteKind,
        records: T[],
      ): T[] =>
        records.flatMap((record) => {
          const resolution = resolveAnchor(index, record.anchor);
          if (resolution.status === 'unattached') {
            unattached.push({ kind, record });
            return [];
          }
          if (resolution.status === 'repaired') {
            repairs.push(updateAnchor(db, kind, record.id, resolution.anchor));
            return [{ ...record, anchor: resolution.anchor }];
          }
          return [record];
        });
      const definitions = resolve('definitions', notes.definitions);
      const annotations = resolve('annotations', notes.annotations);
      // Oldest first, so new notes appear last and entries keep their places (DEF-031).
      definitions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      annotations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      await Promise.all(repairs);
      if (!cancelled) {
        setState({ definitions, annotations, unattached, loaded: true });
      }
    };
    void load();
    const unsubscribe = subscribeNotes((change) => {
      if (change.playId === playId && change.versionId === versionId) {
        void load();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [playId, versionId, index]);

  return state;
}
