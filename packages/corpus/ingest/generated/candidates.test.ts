import { describe, expect, it } from '@jest/globals';
import { gzipSync } from 'fflate';

import { forms, scowlWords, selectCandidates } from './candidates.ts';
import { common, commonest, doc, sourced } from './fixture.ts';

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
  const candidates = selectCandidates(doc, sourced, common, commonest);
  const words = candidates.map((c) => c.word);

  it('GEN-001: uncommon words, and other occurrences of Onions headwords, in order', () => {
    expect(words).toEqual(['yare', 'still', 'bermoothes', 'whither']);
    expect(candidates[0]?.occurrences).toEqual([
      { nodeId: 'ftln-0001', start: 17, end: 21, word: 'yare' },
      { nodeId: 'ftln-0002', start: 0, end: 4, word: 'Yare' },
      { nodeId: 'ftln-0002', start: 6, end: 10, word: 'yare' },
    ]);
    // "still" is defined by Onions in line 4, so line 3's occurrence is a candidate.
    expect(candidates[1]?.occurrences).toEqual([
      { nodeId: 'ftln-0003', start: 0, end: 5, word: 'Still' },
    ]);
    // Onions defines "fool" too, but it is among the commonest words: line 7's is ordinary.
    expect(words).not.toContain('fool');
    // Schmidt's headwords do not count: "master" is not a candidate in line 7.
    expect(words).not.toContain('master');
  });

  it('GEN-002: leaves out defined occurrences, function words, character names and the rest', () => {
    // Defined by Schmidt; function words, though uncommon; character names, also possessive;
    // a numeral; "I"; a stage direction.
    for (const word of [
      'topsail',
      'wilt',
      'wast',
      'thou',
      'gonzalo',
      'ariel',
      "ariel's",
      'ii',
      'i',
      'yarely',
    ]) {
      expect(words).not.toContain(word);
    }
    // Other proper names are candidates like any uncommon word.
    expect(candidates.find((c) => c.word === 'bermoothes')?.occurrences).toEqual([
      { nodeId: 'ftln-0003', start: 17, end: 27, word: 'Bermoothes' },
    ]);
  });
});
