import { createHash } from 'node:crypto';

import type { TextNode, VersionDocument } from '../../src/schema.ts';

/** Every text node of a version in document order. */
export function textNodes(doc: Pick<VersionDocument, 'divisions'>): TextNode[] {
  return doc.divisions.flatMap((act) =>
    act.scenes.flatMap((scene) =>
      scene.blocks.flatMap((block) => (block.type === 'speech' ? block.nodes : [block.node])),
    ),
  );
}

/** Content hash of a version's text nodes (CRP-025). */
export function computeRevision(doc: Pick<VersionDocument, 'divisions'>): string {
  const hash = createHash('sha256');
  for (const node of textNodes(doc)) {
    hash.update(`${node.id}\t${node.text}\n`);
  }
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}
