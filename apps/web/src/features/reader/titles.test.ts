import { describe, expect, it } from '@jest/globals';

import { sceneShortTitle, sceneTitle } from './titles';

describe('scene titles', () => {
  it('RDR-021: names scenes, prologues and epilogues', () => {
    expect(sceneTitle({ kind: 'scene', n: 1 }, 3)).toBe('Act 3, Scene 1');
    expect(sceneTitle({ kind: 'epilogue', n: null }, null)).toBe('Epilogue');
    expect(sceneTitle({ kind: 'epilogue', n: null }, 5)).toBe('Act 5, Epilogue');
  });

  it('RDR-021: marks the later part of a scene a version returns to', () => {
    const later = { id: '2.2b', kind: 'scene' as const, n: 2 };
    expect(sceneTitle(later, 2)).toBe('Act 2, Scene 2 (continued)');
    expect(sceneShortTitle(later, 2)).toBe('2.2…');
    expect(sceneTitle({ id: '2.2', kind: 'scene', n: 2 }, 2)).toBe('Act 2, Scene 2');
  });
});
