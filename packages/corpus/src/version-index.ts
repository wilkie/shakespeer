import type { Scene, SpeechBlock, TextNode, VersionDocument } from './schema';

export interface IndexedScene {
  scene: Scene;
  /** Index of the scene's first text node in document order. */
  start: number;
  /** One past the scene's last text node. */
  end: number;
  actN: number | null;
}

/**
 * Document-order view of a version (ANC-003): every text node with its sequence index, the
 * scene and speech containing it, and lookups by ID and line number.
 */
export interface VersionIndex {
  readonly doc: VersionDocument;
  readonly nodes: readonly TextNode[];
  readonly scenes: readonly IndexedScene[];
  indexOf(nodeId: string): number | undefined;
  node(nodeId: string): TextNode | undefined;
  sceneAt(index: number): IndexedScene | undefined;
  speechOf(nodeId: string): SpeechBlock | undefined;
  /** The line with this display number (CRP-040, CRP-041). */
  lineByNumber(n: string): TextNode | undefined;
}

export function createVersionIndex(doc: VersionDocument): VersionIndex {
  const nodes: TextNode[] = [];
  const scenes: IndexedScene[] = [];
  const speeches = new Map<string, SpeechBlock>();
  for (const act of doc.divisions) {
    for (const scene of act.scenes) {
      const start = nodes.length;
      for (const block of scene.blocks) {
        if (block.type === 'speech') {
          for (const node of block.nodes) {
            nodes.push(node);
            speeches.set(node.id, block);
          }
        } else {
          nodes.push(block.node);
        }
      }
      scenes.push({ scene, start, end: nodes.length, actN: act.n });
    }
  }
  const positions = new Map(nodes.map((node, index) => [node.id, index]));
  const byNumber = new Map(
    nodes.flatMap((node) => (node.kind === 'line' && node.n ? [[node.n, node] as const] : [])),
  );

  return {
    doc,
    nodes,
    scenes,
    indexOf: (nodeId) => positions.get(nodeId),
    node: (nodeId) => {
      const index = positions.get(nodeId);
      return index === undefined ? undefined : nodes[index];
    },
    sceneAt: (index) => scenes.find((s) => index >= s.start && index < s.end),
    speechOf: (nodeId) => speeches.get(nodeId),
    lineByNumber: (n) => byNumber.get(n),
  };
}
