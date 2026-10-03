import type { AlignmentFile } from '@shakespeer/corpus';

/**
 * Maps a node of one version to the corresponding node of another through an alignment
 * (RDR-040): its counterpart, else the counterpart of the nearest preceding aligned node.
 */
export function mapThroughAlignment(
  alignment: AlignmentFile,
  nodeId: string,
  direction: 'to-modern' | 'to-original',
): string | undefined {
  const from = direction === 'to-modern' ? 'orig' : 'modern';
  const to = direction === 'to-modern' ? 'modern' : 'orig';
  const entries = alignment.entries;
  const position = entries.findIndex((entry) => entry[from].includes(nodeId));
  if (position < 0) {
    return undefined;
  }
  for (let i = position; i >= 0; i -= 1) {
    const counterpart = entries[i]?.[to][0];
    if (counterpart) {
      return counterpart;
    }
  }
  return undefined;
}
