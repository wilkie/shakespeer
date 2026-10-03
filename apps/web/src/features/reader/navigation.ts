import type { VersionIndex } from '@shakespeer/corpus';

export interface SceneNavigation {
  /** Scene index the previous button goes to, and whether it goes to its start (MAP-022). */
  previous: number | undefined;
  next: number | undefined;
}

/**
 * Previous goes to the start of the current scene when the reader is past its first line,
 * otherwise to the previous scene (MAP-022); next goes to the next scene (MAP-023).
 */
export function sceneNavigation(
  index: VersionIndex,
  currentIndex: number | undefined,
): SceneNavigation {
  if (currentIndex === undefined) {
    return { previous: undefined, next: index.scenes.length > 1 ? 1 : undefined };
  }
  const sceneIndex = index.scenes.findIndex((s) => currentIndex >= s.start && currentIndex < s.end);
  const scene = index.scenes[sceneIndex];
  if (!scene) {
    return { previous: undefined, next: undefined };
  }
  const atStart = currentIndex === scene.start;
  const previous = atStart ? (sceneIndex > 0 ? sceneIndex - 1 : undefined) : sceneIndex;
  const next = sceneIndex < index.scenes.length - 1 ? sceneIndex + 1 : undefined;
  return { previous, next };
}
