import { beforeAll, describe, expect, it } from '@jest/globals';
import { createVersionIndex, loadVersion, type VersionIndex } from '@shakespeer/corpus';

import { sceneNavigation } from './navigation';
import { sceneTitle } from './titles';

describe('sceneNavigation', () => {
  let index: VersionIndex;

  beforeAll(async () => {
    index = createVersionIndex(await loadVersion('the-tempest', 'folger'));
  });

  it('MAP-024: has no previous scene at the very start', () => {
    expect(sceneNavigation(index, 0)).toStrictEqual({ previous: undefined, next: 1 });
  });

  it('MAP-022: goes to the start of the current scene when past its first line', () => {
    const second = index.scenes[1];
    expect(sceneNavigation(index, (second?.start ?? 0) + 5)).toStrictEqual({
      previous: 1,
      next: 2,
    });
    expect(sceneNavigation(index, second?.start)).toStrictEqual({ previous: 0, next: 2 });
  });

  it('MAP-024: has no next scene in the last scene', () => {
    const last = index.scenes.length - 1;
    expect(sceneNavigation(index, index.nodes.length - 1)).toStrictEqual({
      previous: last,
      next: undefined,
    });
  });

  it('MAP-005: titles scenes, prologues and epilogues', () => {
    expect(index.scenes.map((s) => sceneTitle(s.scene, s.actN)).slice(-2)).toStrictEqual([
      'Act 5, Scene 1',
      'Act 5, Epilogue',
    ]);
  });
});
