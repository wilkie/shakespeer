import type { VersionIndex } from '@shakespeer/corpus';
import {
  listCuts,
  saveCut,
  subscribeCuts,
  type CutOperation,
  type CutRecord,
} from '@shakespeer/storage';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { getDatabase, getSettings } from '@/lib/storage';

import { displayCut, type DisplayCut } from './display';

/** A version's cuts, reloaded whenever they change, in this tab or another (STO-004). */
export function useCutList(
  playId: string,
  versionId: string,
): { cuts: CutRecord[]; loaded: boolean; replace: (cut: CutRecord) => void } {
  const key = `${playId}/${versionId}`;
  const [state, setState] = useState<{ key: string; cuts: CutRecord[]; loaded: boolean }>({
    key,
    cuts: [],
    loaded: false,
  });
  if (state.key !== key) {
    setState({ key, cuts: [], loaded: false });
  }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const cuts = await listCuts(await getDatabase(), playId, versionId);
      if (!cancelled) {
        setState({ key: `${playId}/${versionId}`, cuts, loaded: true });
      }
    };
    void load();
    const unsubscribe = subscribeCuts((change) => {
      if (change.playId === playId && change.versionId === versionId) {
        void load();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [playId, versionId]);

  return {
    cuts: state.key === key ? state.cuts : [],
    loaded: state.key === key && state.loaded,
    // Shows a saved cut at once, before the reload.
    replace: (cut) => {
      setState((previous) => ({
        ...previous,
        cuts: previous.cuts.map((c) => (c.id === cut.id ? cut : c)),
      }));
    },
  };
}

const lastCutKey = (playId: string, versionId: string) =>
  `reader.lastCut.${playId}.${versionId}` as const;

/** The cut ID in a URL's query (`?cut=`), if any (CUT-022). */
function urlCut(search: string): string | undefined {
  return new URLSearchParams(search).get('cut') ?? undefined;
}

export interface CutState {
  cuts: CutRecord[];
  /** The current cut; undefined is Full play (CUT-001). */
  current: CutRecord | undefined;
  display: DisplayCut | undefined;
  select: (cutId: string | undefined, options?: { edit?: boolean }) => void;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  /** Saves new operations for the current cut, keeping the old ones for undo (CUT-030). */
  apply: (operations: CutOperation[]) => void;
  canUndo: boolean;
  undo: () => void;
}

/**
 * The reader's current cut for a version: from the URL, else the one last used (CUT-022), and
 * its editing session (CUT-030).
 */
export function useCut(playId: string, versionId: string, index: VersionIndex): CutState {
  const key = `${playId}/${versionId}`;
  const { cuts, loaded, replace } = useCutList(playId, versionId);
  // As the version opened; later changes to the query are this hook's own.
  const { search } = useLocation();
  // `null` until the remembered cut has been read.
  const [selection, setSelection] = useState<{ key: string; cutId: string | undefined | null }>(
    () => ({ key, cutId: urlCut(search) ?? null }),
  );
  const [session, setSession] = useState<{
    cutId: string | undefined;
    editing: boolean;
    undo: CutOperation[][];
  }>({ cutId: undefined, editing: false, undo: [] });
  if (selection.key !== key) {
    // A version switch: its URL has no cut, so the remembered one applies (CUT-023).
    setSelection({ key, cutId: urlCut(search) ?? null });
  }

  useEffect(() => {
    if (selection.cutId !== null) {
      return;
    }
    let cancelled = false;
    void getSettings()
      .then((settings) => settings.get(lastCutKey(playId, versionId)))
      .then((remembered) => {
        if (!cancelled) {
          setSelection((previous) =>
            previous.key === `${playId}/${versionId}` && previous.cutId === null
              ? { ...previous, cutId: remembered === '' ? undefined : remembered }
              : previous,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selection.cutId, playId, versionId]);

  const wanted = selection.key === key ? selection.cutId : null;
  // An unknown cut falls back to Full play (CUT-022).
  const current =
    loaded && typeof wanted === 'string' ? cuts.find((cut) => cut.id === wanted) : undefined;

  // Keep the URL in step, leaving the fragment alone (it tracks the current line, RDR-031).
  const currentId = current?.id;
  const settled = loaded && wanted !== null;
  useEffect(() => {
    if (!settled) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (currentId) {
      params.set('cut', currentId);
    } else {
      params.delete('cut');
    }
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [settled, currentId]);

  const display = current ? displayCut(index, current) : undefined;
  const activeSession =
    session.cutId === currentId ? session : { cutId: currentId, editing: false, undo: [] };

  const save = (record: CutRecord, operations: CutOperation[]) => {
    const next = { ...record, operations };
    replace(next);
    void getDatabase().then((db) => saveCut(db, next));
  };

  return {
    cuts,
    current,
    display,
    select: (cutId, options) => {
      setSelection({ key, cutId });
      setSession({ cutId, editing: options?.edit ?? false, undo: [] });
      void getSettings().then((settings) =>
        settings.set(lastCutKey(playId, versionId), cutId ?? ''),
      );
    },
    editing: activeSession.editing && current !== undefined,
    setEditing: (editing) => {
      setSession({ ...activeSession, editing });
    },
    apply: (operations) => {
      if (!current || !display) {
        return;
      }
      setSession({
        ...activeSession,
        undo: [...activeSession.undo, current.operations],
      });
      save(current, operations);
    },
    canUndo: activeSession.undo.length > 0,
    undo: () => {
      const previous = activeSession.undo.at(-1);
      if (!current || !previous) {
        return;
      }
      setSession({ ...activeSession, undo: activeSession.undo.slice(0, -1) });
      save(current, previous);
    },
  };
}

/** The operations to edit from: those found in the text, with repaired anchors, then the rest. */
export function editableOperations(display: DisplayCut): CutOperation[] {
  return [...display.operations, ...display.unattached];
}
