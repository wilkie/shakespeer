import type { VersionIndex } from '@shakespeer/corpus';

/**
 * URL fragments for reading positions (RDR-031, CRP-041): a line number ("3.1.56"), or a
 * number plus an offset for nodes without one ("3.1.56+2"), or a scene ("3.1", "3.1+4").
 */
export function fragmentFor(index: VersionIndex, nodeId: string): string | undefined {
  const position = index.indexOf(nodeId);
  if (position === undefined) {
    return undefined;
  }
  const scene = index.sceneAt(position);
  if (!scene) {
    return undefined;
  }
  for (let i = position; i >= scene.start; i -= 1) {
    const node = index.nodes[i];
    if (node?.kind === 'line' && node.n) {
      return i === position ? node.n : `${node.n}+${String(position - i)}`;
    }
  }
  const offset = position - scene.start;
  return offset === 0 ? scene.scene.id : `${scene.scene.id}+${String(offset)}`;
}

export type FragmentTarget =
  { kind: 'node'; nodeId: string } | { kind: 'scene'; sceneIndex: number };

export function resolveFragment(index: VersionIndex, fragment: string): FragmentTarget | undefined {
  const decoded = decodeURIComponent(fragment.replace(/^#/, ''));
  if (decoded === '') {
    return undefined;
  }
  const [base = '', offsetText] = decoded.split('+');
  const offset = offsetText === undefined ? 0 : Number(offsetText);
  if (!Number.isInteger(offset) || offset < 0) {
    return undefined;
  }

  const line = index.lineByNumber(base);
  if (line) {
    const position = (index.indexOf(line.id) ?? 0) + offset;
    const node = index.nodes[position];
    return node ? { kind: 'node', nodeId: node.id } : undefined;
  }
  const sceneIndex = index.scenes.findIndex((s) => s.scene.id === base);
  const scene = index.scenes[sceneIndex];
  if (!scene) {
    return undefined;
  }
  if (offsetText === undefined) {
    return { kind: 'scene', sceneIndex };
  }
  const node = index.nodes[scene.start + offset];
  return node && scene.start + offset < scene.end ? { kind: 'node', nodeId: node.id } : undefined;
}
