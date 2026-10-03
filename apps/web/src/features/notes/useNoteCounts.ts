import { countNotes, subscribeNotes, type NoteCounts } from '@shakespeer/storage';
import { useEffect, useState } from 'react';

import { getDatabase } from '@/lib/storage';

/**
 * Own and imported note counts per play and version (RDR-042, SEL-006), kept current as notes
 * change.
 */
export function useNoteCounts(
  playIds: readonly string[],
): ReadonlyMap<string, ReadonlyMap<string, NoteCounts>> {
  const [counts, setCounts] = useState<ReadonlyMap<string, ReadonlyMap<string, NoteCounts>>>(
    new Map(),
  );
  const key = playIds.join(' ');
  useEffect(() => {
    const ids = key.split(' ').filter(Boolean);
    let cancelled = false;
    const load = async () => {
      const db = await getDatabase();
      const entries = await Promise.all(
        ids.map(async (id) => [id, await countNotes(db, id)] as const),
      );
      if (!cancelled) {
        setCounts(new Map(entries));
      }
    };
    void load();
    const unsubscribe = subscribeNotes((change) => {
      if (ids.includes(change.playId)) {
        void load();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [key]);
  return counts;
}

/** The total of own and imported notes in some counts. */
export function totalNotes(counts: Iterable<NoteCounts> | undefined): number {
  let total = 0;
  for (const count of counts ?? []) {
    total += count.own + count.imported;
  }
  return total;
}
