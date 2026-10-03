import { listCollections, subscribeNotes, type CollectionSummary } from '@shakespeer/storage';
import { useEffect, useState } from 'react';

import { getDatabase } from '@/lib/storage';

/** A play's imported collections, kept current as notes and collections change (IOX-020). */
export function useCollections(playId: string): CollectionSummary[] {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await listCollections(await getDatabase(), playId);
      if (!cancelled) {
        setCollections(list);
      }
    };
    void load();
    const unsubscribe = subscribeNotes((change) => {
      if (change.playId === playId) {
        void load();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [playId]);
  return collections;
}
