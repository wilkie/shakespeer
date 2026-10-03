import type { Scene } from '@shakespeer/corpus';

const KIND_NAMES: Record<Scene['kind'], string> = {
  scene: 'Scene',
  prologue: 'Prologue',
  epilogue: 'Epilogue',
  induction: 'Induction',
};

/** "Act 3, Scene 1", "Epilogue", "Act 5, Epilogue" (RDR-021, MAP-005). */
export function sceneTitle(scene: Pick<Scene, 'kind' | 'n'>, actN: number | null): string {
  const part = scene.kind === 'scene' ? `Scene ${String(scene.n)}` : KIND_NAMES[scene.kind];
  return actN === null ? part : `Act ${String(actN)}, ${part}`;
}

/** Compact form for narrow controls: "3.1", "Epi." */
export function sceneShortTitle(scene: Pick<Scene, 'kind' | 'n'>, actN: number | null): string {
  if (scene.kind === 'scene') {
    return `${String(actN)}.${String(scene.n)}`;
  }
  return `${KIND_NAMES[scene.kind].slice(0, 3)}.`;
}
