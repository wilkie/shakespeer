import type { VersionIndex } from '@shakespeer/corpus';

export interface SceneNavigation {
  /** Scene index the previous button goes to, and whether it goes to its start (MAP-022). */
  previous: number | undefined;
  next: number | undefined;
}

/**
 * Previous goes to the start of the current scene when the reader is past its first line,
 * otherwise to the previous scene (MAP-022); next goes to the next scene (MAP-023). Scenes a
 * cut hides entirely are skipped (CUT-045).
 */
export function sceneNavigation(
  index: VersionIndex,
  currentIndex: number | undefined,
): SceneNavigation {
  const shown = (i: number) => {
    const scene = index.scenes[i];
    return scene !== undefined && scene.end > scene.start;
  };
  const after = (i: number) => {
    for (let j = i + 1; j < index.scenes.length; j += 1) {
      if (shown(j)) {
        return j;
      }
    }
    return undefined;
  };
  const before = (i: number) => {
    for (let j = i - 1; j >= 0; j -= 1) {
      if (shown(j)) {
        return j;
      }
    }
    return undefined;
  };
  if (currentIndex === undefined) {
    const first = shown(0) ? 0 : after(0);
    return { previous: undefined, next: first === undefined ? undefined : after(first) };
  }
  const sceneIndex = index.scenes.findIndex((s) => currentIndex >= s.start && currentIndex < s.end);
  const scene = index.scenes[sceneIndex];
  if (!scene) {
    return { previous: undefined, next: undefined };
  }
  const atStart = currentIndex === scene.start;
  return { previous: atStart ? before(sceneIndex) : sceneIndex, next: after(sceneIndex) };
}
