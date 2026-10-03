import type { TextAnchor, VersionIndex } from '@shakespeer/corpus';
import {
  deleteNote,
  restoreSnapshot,
  saveNote,
  snapshotNotes,
  trackCreated,
  type AnnotationRecord,
  type DefinitionRecord,
  type NoteKind,
  type NoteSnapshot,
} from '@shakespeer/storage';
import { useRef, useState } from 'react';

import type { NoteIndex } from '@/features/notes/noteIndex';
import { getDatabase } from '@/lib/storage';
import { setSetting, useSetting } from '@/lib/useSetting';

import { anchorKey, comparePositions } from './anchors';
import type { PanelTerm, SaveStatus } from './NotesPanel';

interface PanelState {
  terms: { key: string; anchor: TextAnchor }[];
  annotationIds: string[];
  /** Annotations created here, shown until the stored copy arrives. */
  created: AnnotationRecord[];
  /** New definitions not yet saved (DEF-021). */
  drafts: DefinitionRecord[];
  editing: boolean;
  focusId: string | undefined;
}

interface EditSession {
  snapshot: Promise<NoteSnapshot>;
  /** Notes saved during the session, to delete on Cancel if they are new (PNL-023). */
  saved: Map<string, NoteKind>;
  /** Deletions are not undone by Cancel (PNL-026). */
  deleted: Set<string>;
}

function newId(): string {
  return crypto.randomUUID();
}

/**
 * The notes panel's contents and its edit sessions (PNL): what it shows, edit mode with implicit
 * saving and Cancel, and the save status.
 */
export function useNotesPanel(
  playId: string,
  versionId: string,
  index: VersionIndex,
  notes: NoteIndex,
) {
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastColor] = useSetting('annotations.lastColor', 'yellow');
  const session = useRef<EditSession | null>(null);
  const pending = useRef(new Set<Promise<void>>());
  const failed = useRef<(() => Promise<void>) | null>(null);
  const cancelling = useRef(false);
  /** Deleted notes, whose editors may still flush a save as they unmount. */
  const deleted = useRef(new Set<string>());

  /** Runs a storage write, tracking the status line (PNL-027). */
  const write = (operation: () => Promise<void>) => {
    setStatus('saving');
    const promise = operation().then(
      () => {
        pending.current.delete(promise);
        if (pending.current.size === 0 && !failed.current) {
          setStatus('saved');
        }
      },
      () => {
        pending.current.delete(promise);
        failed.current = operation;
        setStatus('error');
      },
    );
    pending.current.add(promise);
  };

  const retry = () => {
    const operation = failed.current;
    failed.current = null;
    if (operation) {
      write(operation);
    }
  };

  const beginSession = (
    state: PanelState,
    created: readonly { kind: NoteKind; id: string }[] = [],
  ) => {
    const existing = [
      ...state.terms.flatMap(({ key }) =>
        (notes.term(key)?.definitions ?? []).map((d) => ({
          kind: 'definitions' as const,
          id: d.id,
        })),
      ),
      ...state.annotationIds.map((id) => ({ kind: 'annotations' as const, id })),
    ].filter((entry) => !created.some((c) => c.id === entry.id));
    session.current = {
      snapshot: getDatabase().then((db) => snapshotNotes(db, playId, versionId, existing)),
      saved: new Map(created.map((c) => [c.id, c.kind])),
      deleted: new Set(),
    };
  };

  const open = (next: PanelState, created: readonly { kind: NoteKind; id: string }[] = []) => {
    // Replacing the contents keeps the previous session's changes (PNL-005, PNL-024).
    session.current = null;
    if (next.editing) {
      beginSession(next, created);
    }
    setStatus('idle');
    setPanel(next);
  };

  /** Opens every note covering an activated point (PNL-010). */
  const openAt = (termKeys: readonly string[], annotationIds: readonly string[]) => {
    const terms = termKeys.flatMap((key) => {
      const group = notes.term(key);
      return group ? [{ key, anchor: group.anchor }] : [];
    });
    const annotations = annotationIds
      .flatMap((id) => notes.annotation(id) ?? [])
      .sort((a, b) => comparePositions(index, a.anchor.start, b.anchor.start) ?? 0);
    if (terms.length === 0 && annotations.length === 0) {
      return false;
    }
    open({
      terms,
      annotationIds: annotations.map((a) => a.id),
      created: [],
      drafts: [],
      editing: false,
      focusId: undefined,
    });
    return true;
  };

  const blankDefinition = (anchor: TextAnchor): DefinitionRecord => {
    const now = new Date().toISOString();
    return {
      id: newId(),
      playId,
      versionId,
      anchor,
      origin: { kind: 'own' },
      createdAt: now,
      updatedAt: now,
      meaning: '',
    };
  };

  /** Add definition from a selection: the term at that anchor, with a blank definition (SELX-006). */
  const define = (anchor: TextAnchor) => {
    const key = anchorKey(anchor);
    const draft = blankDefinition(notes.term(key)?.anchor ?? anchor);
    open({
      terms: [{ key, anchor: draft.anchor }],
      annotationIds: [],
      created: [],
      drafts: [draft],
      editing: true,
      focusId: draft.id,
    });
  };

  /** Add annotation from a selection: created at once in the last color (SELX-007, ANN-011). */
  const annotate = (anchor: TextAnchor) => {
    const now = new Date().toISOString();
    const record: AnnotationRecord = {
      id: newId(),
      playId,
      versionId,
      anchor,
      origin: { kind: 'own' },
      createdAt: now,
      updatedAt: now,
      color: lastColor,
      notes: '',
      links: [],
      citations: [],
    };
    write(async () => {
      await saveNote(await getDatabase(), 'annotations', record);
    });
    open(
      {
        terms: [],
        annotationIds: [record.id],
        created: [record],
        drafts: [],
        editing: true,
        focusId: record.id,
      },
      [{ kind: 'annotations', id: record.id }],
    );
  };

  const close = () => {
    session.current = null;
    setPanel(null);
  };

  const toggleEdit = () => {
    if (!panel) {
      return;
    }
    if (panel.editing) {
      // Leaving edit mode keeps changes; unsaved blank definitions are discarded (PNL-024/025).
      session.current = null;
      setPanel({ ...panel, editing: false, drafts: [], focusId: undefined });
    } else {
      const next = { ...panel, editing: true };
      beginSession(next);
      setPanel(next);
    }
  };

  /** Reverts everything in the panel to how it was when edit mode began (PNL-023). */
  const cancel = async () => {
    const current = session.current;
    if (!panel || !current) {
      return;
    }
    session.current = null;
    // Editors flush their drafts as they unmount; those saves must not land after the restore.
    cancelling.current = true;
    setPanel({ ...panel, editing: false, drafts: [], created: [], focusId: undefined });
    try {
      await Promise.all(pending.current);
      let snapshot = await current.snapshot;
      snapshot = {
        ...snapshot,
        entries: snapshot.entries.filter((entry) => !current.deleted.has(entry.id)),
      };
      for (const [id, kind] of current.saved) {
        if (!current.deleted.has(id)) {
          snapshot = trackCreated(snapshot, kind, id);
        }
      }
      const restored = snapshot;
      write(async () => {
        await restoreSnapshot(await getDatabase(), restored);
      });
      await Promise.all(pending.current);
    } finally {
      cancelling.current = false;
    }
    // Nothing left that existed before the session: close (PNL-023).
    const before = (await current.snapshot).entries.filter(
      (entry) => entry.record && !current.deleted.has(entry.id),
    );
    if (before.length === 0 && !panel.terms.some(({ key }) => notes.term(key)?.sourced.length)) {
      setPanel(null);
    }
  };

  const save = <K extends NoteKind>(
    kind: K,
    record: K extends 'definitions' ? DefinitionRecord : AnnotationRecord,
  ) => {
    if (cancelling.current || deleted.current.has(record.id)) {
      return;
    }
    session.current?.saved.set(record.id, session.current.saved.get(record.id) ?? kind);
    write(async () => {
      await saveNote(await getDatabase(), kind, record);
    });
  };

  const saveDefinition = (record: DefinitionRecord) => {
    save('definitions', record);
  };

  const saveAnnotation = (record: AnnotationRecord) => {
    save('annotations', record);
    if (record.color !== lastColor) {
      void setSetting('annotations.lastColor', record.color);
    }
  };

  const remove = (kind: NoteKind, id: string) => {
    deleted.current.add(id);
    session.current?.deleted.add(id);
    if (panel) {
      setPanel({
        ...panel,
        drafts: panel.drafts.filter((d) => d.id !== id),
        annotationIds: panel.annotationIds.filter((a) => a !== id),
        created: panel.created.filter((a) => a.id !== id),
      });
    }
    // A draft may never have been saved; deleting it then changes nothing.
    write(async () => {
      await deleteNote(await getDatabase(), kind, id);
    });
  };

  const terms: PanelTerm[] = (panel?.terms ?? []).flatMap(({ key, anchor }) => {
    const group = notes.term(key);
    const drafts = (panel?.drafts ?? []).filter((d) => anchorKey(d.anchor) === key);
    // A term with nothing left is gone (DEF-023).
    return group || drafts.length > 0
      ? [{ key, anchor: group?.anchor ?? anchor, group, drafts }]
      : [];
  });
  const annotations = (panel?.annotationIds ?? []).flatMap(
    (id) => notes.annotation(id) ?? panel?.created.find((a) => a.id === id) ?? [],
  );

  return {
    isOpen: panel !== null,
    terms,
    annotations,
    editing: panel?.editing ?? false,
    focusId: panel?.focusId,
    status,
    openAt,
    define,
    annotate,
    close,
    toggleEdit,
    cancel: () => {
      void cancel();
    },
    retry,
    addDefinition: (term: PanelTerm) => {
      if (!panel) {
        return;
      }
      const draft = blankDefinition(term.anchor);
      setPanel({ ...panel, drafts: [...panel.drafts, draft], focusId: draft.id });
    },
    saveDefinition,
    deleteDefinition: (record: DefinitionRecord) => {
      remove('definitions', record.id);
    },
    saveAnnotation,
    deleteAnnotation: (record: AnnotationRecord) => {
      remove('annotations', record.id);
    },
  };
}
