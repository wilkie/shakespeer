import type { Scene } from '@shakespeer/corpus';

const KIND_NAMES: Record<Scene['kind'], string> = {
  scene: 'Scene',
  prologue: 'Prologue',
  epilogue: 'Epilogue',
  induction: 'Induction',
};

/** Whether a scene is a later part of one the version already had ("2.2b", CRP-031). */
function isContinuation(scene: { id?: string }): boolean {
  return /\d[b-z]$/.test(scene.id ?? '');
}

/** "Act 3, Scene 1", "Epilogue", "Act 5, Epilogue", "Act 2, Scene 2 (continued)" (RDR-021, MAP-005). */
export function sceneTitle(
  scene: Pick<Scene, 'kind' | 'n'> & { id?: string },
  actN: number | null,
): string {
  const part = scene.kind === 'scene' ? `Scene ${String(scene.n)}` : KIND_NAMES[scene.kind];
  const title = actN === null ? part : `Act ${String(actN)}, ${part}`;
  return isContinuation(scene) ? `${title} (continued)` : title;
}

/** Compact form for narrow controls: "3.1", "Epi." */
export function sceneShortTitle(
  scene: Pick<Scene, 'kind' | 'n'> & { id?: string },
  actN: number | null,
): string {
  if (scene.kind === 'scene') {
    return `${String(actN)}.${String(scene.n)}${isContinuation(scene) ? '…' : ''}`;
  }
  return `${KIND_NAMES[scene.kind].slice(0, 3)}.`;
}
