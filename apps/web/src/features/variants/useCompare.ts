import {
  createVersionIndex,
  loadAlignment,
  loadVersion,
  type AlignmentFile,
  type PlayInfo,
  type VersionDocument,
  type VersionIndex,
  type VersionInfo,
} from '@shakespeer/corpus';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { compareRows, type CompareRow } from './compare';

interface Loaded {
  key: string;
  doc: VersionDocument;
  alignment: AlignmentFile | undefined;
}

export interface CompareState {
  /** The compared version, if comparing (VAR-020). */
  version: VersionInfo | undefined;
  rows: CompareRow[] | undefined;
  right: VersionIndex | undefined;
  select: (versionId: string | undefined) => void;
  exact: boolean;
  setExact: (exact: boolean) => void;
}

/**
 * The comparison view's state: the compared version from the URL (`?compare=`), loaded with
 * its alignment, and the rows against the current version (VAR-020, VAR-021). Not remembered.
 */
export function useCompare(
  play: PlayInfo,
  version: VersionInfo,
  index: VersionIndex,
  alignment: AlignmentFile | undefined,
): CompareState {
  const key = `${play.id}/${version.id}`;
  const { search } = useLocation();
  const fromUrl = new URLSearchParams(search).get('compare') ?? undefined;
  const [selection, setSelection] = useState({ key, versionId: fromUrl });
  const [exact, setExact] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | undefined>();
  if (selection.key !== key) {
    setSelection({ key, versionId: fromUrl });
  }
  const wanted = selection.key === key ? selection.versionId : fromUrl;
  // Only another version of this play can be compared (VAR-026).
  const target = wanted !== version.id ? play.versions.find((v) => v.id === wanted) : undefined;

  useEffect(() => {
    if (!target) {
      return;
    }
    let cancelled = false;
    const targetKey = `${play.id}/${target.id}`;
    void Promise.all([
      loadVersion(play.id, target.id),
      target.kind === 'original' ? loadAlignment(play.id, target.id) : undefined,
    ]).then(([doc, targetAlignment]) => {
      if (!cancelled) {
        setLoaded({ key: targetKey, doc, alignment: targetAlignment });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [play.id, target]);

  // The URL follows the comparison, leaving the fragment alone (RDR-031).
  const targetId = target?.id;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (targetId) {
      params.set('compare', targetId);
    } else {
      params.delete('compare');
    }
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [targetId]);

  const ready = target && loaded?.key === `${play.id}/${target.id}` ? loaded : undefined;
  const right = ready ? createVersionIndex(ready.doc) : undefined;
  const rows =
    ready && right
      ? compareRows({ index, alignment }, { index: right, alignment: ready.alignment })
      : undefined;
  return {
    version: target,
    rows,
    right,
    select: (versionId) => {
      setSelection({ key, versionId });
    },
    exact,
    setExact,
  };
}
