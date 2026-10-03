import { describe, expect, it } from '@jest/globals';
import type { AlignmentFile } from '@shakespeer/corpus';

import { mapThroughAlignment } from './version-map';

const alignment: AlignmentFile = {
  schemaVersion: 1,
  playId: 'p',
  versionId: 'f1',
  modernVersionId: 'folger',
  revisions: { orig: '', modern: '' },
  entries: [
    { orig: ['o1'], modern: ['m1', 'm2'], relation: 'same', status: 'auto' },
    { orig: [], modern: ['m3'], relation: 'modern-only', status: 'auto' },
    { orig: ['o2'], modern: [], relation: 'orig-only', status: 'auto' },
    { orig: ['o3'], modern: ['m4'], relation: 'variant', status: 'auto' },
  ],
};

describe('mapThroughAlignment', () => {
  it('RDR-040: maps a node to its counterpart', () => {
    expect(mapThroughAlignment(alignment, 'm2', 'to-original')).toBe('o1');
    expect(mapThroughAlignment(alignment, 'o3', 'to-modern')).toBe('m4');
  });

  it('RDR-040: falls back to the nearest preceding aligned node', () => {
    expect(mapThroughAlignment(alignment, 'm3', 'to-original')).toBe('o1');
    expect(mapThroughAlignment(alignment, 'o2', 'to-modern')).toBe('m3');
  });

  it('returns undefined for unknown nodes', () => {
    expect(mapThroughAlignment(alignment, 'zz', 'to-modern')).toBeUndefined();
  });
});
