/** Scenes across versions: reading order, keys, and which modern scene an original one is. */
import type { Scene, VersionDocument } from '../src/schema.ts';

/** A scene in reading order with the act it belongs to. */
export interface Placed {
  actN: number | null;
  scene: Scene;
}

export function placed(doc: Pick<VersionDocument, 'divisions'>): Placed[] {
  return doc.divisions.flatMap((act) => act.scenes.map((scene) => ({ actN: act.n, scene })));
}

/** "2.1", or "prologue", "5.epilogue": how a scene is matched across versions. */
export function sceneKey({ actN, scene }: Placed): string {
  return scene.kind === 'scene'
    ? `${String(actN)}.${String(scene.n)}`
    : actN === null
      ? scene.kind
      : `${String(actN)}.${scene.kind}`;
}

/**
 * The index of the modern scene each original scene corresponds to: the same act and scene, or
 * for a prologue or epilogue, the only one (it may sit in an act in one version and stand alone
 * in the other). Throws for a scene with no counterpart.
 */
export function modernCounterparts(orig: Placed[], modern: Placed[], label: string): number[] {
  const byKey = new Map(modern.map((p, i) => [sceneKey(p), i]));
  const byKind = new Map<string, number[]>();
  modern.forEach((p, i) => {
    byKind.set(p.scene.kind, [...(byKind.get(p.scene.kind) ?? []), i]);
  });
  return orig.map((p) => {
    const sameKind = byKind.get(p.scene.kind) ?? [];
    const index =
      byKey.get(sceneKey(p)) ??
      (p.scene.kind !== 'scene' && sameKind.length === 1 ? sameKind[0] : undefined);
    if (index === undefined) {
      throw new Error(`${label}: scene ${sceneKey(p)} has no modern counterpart`);
    }
    return index;
  });
}
