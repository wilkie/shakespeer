import type { Origin } from '@shakespeer/storage';

export function truncate(text: string, length = 80): string {
  const flat = text.replace(/\n/g, ' / ');
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

/** "You", or the collection a note was imported from (PNL-011, ATR-011). */
export function originLabel(
  origin: Origin,
  collectionName?: (id: string) => string | undefined,
): string {
  return origin.kind === 'own' ? 'You' : (collectionName?.(origin.collectionId) ?? 'Imported');
}
