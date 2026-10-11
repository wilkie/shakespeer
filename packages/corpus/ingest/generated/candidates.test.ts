import { describe, expect, it } from '@jest/globals';
import { gzipSync } from 'fflate';

import { forms, scowlWords, selectCandidates } from './candidates.ts';
import { common, doc, sourced } from './fixture.ts';

/** A ustar archive of the given files, gzipped. */
function tarGz(files: Record<string, Uint8Array>): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const [name, data] of Object.entries(files)) {
    const header = new Uint8Array(512);
    const put = (offset: number, text: string) => {
      header.set(new TextEncoder().encode(text), offset);
    };
    put(0, name);
    put(124, `${data.length.toString(8).padStart(11, '0')}\0`);
    put(156, '0');
    blocks.push(header, data, new Uint8Array((512 - (data.length % 512)) % 512));
  }
  blocks.push(new Uint8Array(1024));
  const tar = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const block of blocks) {
    tar.set(block, offset);
    offset += block.length;
  }
  return gzipSync(tar);
}

describe('scowlWords', () => {
  it('GEN-001: reads the size-50 American lists of a SCOWL release, lower-cased, as Latin-1', () => {
    const words = scowlWords(
      tarGz({
        'scowl/final/english-words.10': new TextEncoder().encode('Hello\nworld\n'),
        'scowl/final/american-words.50': Uint8Array.from([0x63, 0x61, 0x66, 0xe9, 0x0a]), // café
        'scowl/final/english-words.60': new TextEncoder().encode('rare\n'),
        'scowl/final/british-words.10': new TextEncoder().encode('colour\n'),
      }),
    );
    expect([...words].sort()).toEqual(['café', 'hello', 'world']);
  });
});

describe('forms', () => {
  it('GEN-001: covers obvious inflections, accents and elisions', () => {
    expect(forms('cried')).toContain('cry');
    expect(forms('stopping')).toContain('stop');
    expect(forms('goeth')).toContain('go');
    expect(forms('know’st')).toContain('know');
    expect(forms('armèd')).toContain('arm');
    expect(forms('wat’ry')).toContain('watery');
    expect(forms('o’er')).toContain('over');
  });
});

describe('selectCandidates', () => {
  const candidates = selectCandidates(doc, sourced, common);
  const words = candidates.map((c) => c.word);

  it('GEN-001: uncommon words, and other occurrences of Onions headwords, in order', () => {
    expect(words).toEqual(['yare', 'still', 'whither', 'wilt', 'wast']);
    expect(candidates[0]?.occurrences).toEqual([
      { nodeId: 'ftln-0001', start: 17, end: 21, word: 'yare' },
      { nodeId: 'ftln-0002', start: 0, end: 4, word: 'Yare' },
      { nodeId: 'ftln-0002', start: 6, end: 10, word: 'yare' },
    ]);
    // Schmidt's headword "master" is common, so its other occurrence is not a candidate.
    expect(words).not.toContain('master');
  });

  it('GEN-002: leaves out defined occurrences, names, stage directions and single letters', () => {
    // "still" is defined in line 4; only line 3's occurrence remains.
    expect(candidates.find((c) => c.word === 'still')?.occurrences).toEqual([
      { nodeId: 'ftln-0003', start: 0, end: 5, word: 'Still' },
    ]);
    // Defined by Schmidt; character names; a proper name; a numeral; "I"; a stage direction.
    for (const word of ['topsail', 'gonzalo', 'ariel', 'bermoothes', 'ii', 'i', 'yarely']) {
      expect(words).not.toContain(word);
    }
    // A capital at the start of a sentence does not make a name.
    expect(candidates.find((c) => c.word === 'whither')?.occurrences).toHaveLength(2);
  });
});
