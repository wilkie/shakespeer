import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  createVersionIndex,
  getPlay,
  loadAlignment,
  loadVariants,
  loadVersion,
  type PlayInfo,
  type Variant,
} from '@shakespeer/corpus';

import { variantMarks, type VariantMarks } from './marks';

let play: PlayInfo;
let variants: Variant[];
let q2: VariantMarks;

beforeAll(async () => {
  play = getPlay('hamlet') as PlayInfo;
  variants = (await loadVariants('hamlet')).variants;
  const version = play.versions.find((v) => v.id === 'q2-1604');
  if (!version) {
    throw new Error('no Q2');
  }
  q2 = variantMarks(
    createVersionIndex(await loadVersion('hamlet', 'q2-1604')),
    variants,
    version,
    play.versions,
    await loadAlignment('hamlet', 'q2-1604'),
    play.modernVersionId,
  );
});

describe('variant marks', () => {
  it('VAR-001: marks each reading in the margin and its span for the outline', () => {
    // "Polacks" (1.1.74): Q2 reads "He smot the sleaded pollax on the ice."
    expect(q2.starts.get('ham-q2-00077')).toContain('folger-ptr-0002');
    expect(q2.decorations.get('ham-q2-00077')).toContainEqual({
      start: 0,
      end: 38,
      id: 'v:folger-ptr-0002',
    });
    expect(q2.variant('folger-ptr-0002')?.title).toBe('Editorial emendation: “Polacks” (1.1.74)');
  });

  it('VAR-002: marks where a whole passage other printings have is missing', () => {
    const absent = [...q2.absent.values()].flat();
    const exit = absent.find((mark) => mark.variantIds.includes('folger-ptr-0240'));
    expect(exit?.label).toBe('F1 has 1 line here');
    // A passage only the modern edition has is not marked as missing.
    expect(absent.some((mark) => mark.variantIds.includes('folger-ptr-0001'))).toBe(false);
  });

  it('VAR-001: a play without variants has no marks', async () => {
    const version = play.versions.find((v) => v.id === 'folger');
    if (!version) {
      throw new Error('no Folger');
    }
    const none = variantMarks(
      createVersionIndex(await loadVersion('hamlet', 'folger')),
      [],
      version,
      play.versions,
      undefined,
      play.modernVersionId,
    );
    expect(none.starts.size + none.absent.size).toBe(0);
  });
});
