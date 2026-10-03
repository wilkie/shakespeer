import { createContext, useContext } from 'react';

/** Imported collections' names by ID, for showing where a note came from (PNL-011, IOX-016). */
export const CollectionNamesContext = createContext<ReadonlyMap<string, string>>(new Map());

export function useCollectionName(): (id: string) => string | undefined {
  const names = useContext(CollectionNamesContext);
  return (id) => names.get(id);
}
