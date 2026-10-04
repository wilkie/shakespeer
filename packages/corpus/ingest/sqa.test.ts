import { describe, expect, it } from '@jest/globals';

import type { TextNode } from '../src/schema.ts';
import { IdMap } from './lib/ids.ts';
import { convertSqaPlay } from './sqa.ts';

const QUARTO = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
  <div1 type="act" n="1">
    <div2 type="scene" n="1">
      <pb/>
      <pb/>
      <head>The Tragedie of <lb/>HAMLET</head>
      <stage type="entrance">Enter <name>Barnardo</name>, and <name>Francisco</name>, two  <lb/>Centinels.</stage>
      <sp><speaker>Bar.</speaker><l><c rend="droppedCapital">VV</c>Hose there?</l></sp>
      <sp><speaker><add type="suppliedCropped">Fran.</add></speaker>
        <l>From <hi rend="italic">Wittenberg</hi><name>Horatio</name>,<stage type="exit">Exit.</stage><add type="bibliographic">2</add></l>
      </sp>
      <fw type="signature">B.</fw>
      <fw type="catchword">Pol.</fw>
      <pb/>
      <fw type="runningHeader">The Tragedie of Hamlet</fw>
      <sp><speaker>Pol.</speaker>
        <p><hi rend="italic">To my soules Idoll, the most beau&#173;  <lb/>tified</hi> <name>Ophelia</name>, that's an ill  <lb/>phrase, <abbr>frō<expan>from</expan></abbr> my grones<gap reason="absent" unit="chars" extent="2"/> it is <gap reason="absent" unit="words" extent="2"/> <subst><del>were</del><add>make</add></subst>.</p>
      </sp>
      <pb/>
    </div2>
  </div1>
  <div1 type="act" n="2">
    <div2 type="scene" n="1">
      <sp><speaker>Ham.</speaker><l>Words, words, words.</l></sp>
      <fw type="signature">B2<add type="bibliographic">3</add></fw>
      <trailer>FINIS.</trailer>
    </div2>
  </div1>
  <div1 type="addition"><div2><p>A later note.</p></div2></div1>
</body></text></TEI>`;

describe('convertSqaPlay', () => {
  const { divisions, pageBreaks, misprintedSignatures } = convertSqaPlay(QUARTO, {
    ids: IdMap.empty('ham-q2'),
  });
  const blocks = divisions[0]?.scenes[0]?.blocks ?? [];
  const nodes = blocks.flatMap((b): TextNode[] => (b.type === 'speech' ? b.nodes : [b.node]));

  it('CRP-031: keeps the transcription’s act and scene divisions, flagged as editorial', () => {
    expect(
      divisions.map((act) => [act.n, act.editorial, act.scenes.map((s) => [s.id, s.editorial])]),
    ).toStrictEqual([
      [1, true, [['1.1', true]]],
      [2, true, [['2.1', true]]],
    ]);
  });

  it('CRP-030: omits the title, running heads, catchwords, signatures and later page numbers', () => {
    expect(nodes.map((n) => n.text)).not.toContain('The Tragedie of HAMLET');
    expect(nodes.map((n) => n.text).join(' ')).not.toMatch(/Pol\. Pol\.|Tragedie|\b2\b|B\./);
  });

  it('CRP-033: keeps speaker labels, including text a later hand supplied where the page was cropped', () => {
    expect(blocks.map((b) => (b.type === 'speech' ? b.label : 'sd'))).toStrictEqual([
      'sd',
      'Bar.',
      'Fran.',
      'Pol.',
    ]);
  });

  it('CRP-022: places stage directions inside a line after it', () => {
    expect(nodes.slice(0, 4).map((n) => [n.kind, n.text])).toStrictEqual([
      ['sd', 'Enter Barnardo, and Francisco, two Centinels.'],
      ['line', 'VVHose there?'],
      ['line', 'From Wittenberg Horatio,'],
      ['sd', 'Exit.'],
    ]);
    expect(nodes[0]).toMatchObject({ sdType: 'entrance' });
  });

  it('CRP-030: divides prose at its printed line breaks, joining a broken word on the first line', () => {
    expect(nodes.slice(4).map((n) => [n.kind === 'line' && n.form, n.text])).toStrictEqual([
      ['prose', 'To my soules Idoll, the most beautified'],
      ['prose', "Ophelia, that's an ill"],
      ['prose', 'phrase, frō my grones•• it is • • were.'],
    ]);
    expect(nodes[4]).toMatchObject({ marks: [{ start: 0, end: 39, type: 'italic' }] });
  });

  it('CRP-032: marks missing characters and words as gaps', () => {
    expect(nodes[6]).toMatchObject({
      marks: [
        { start: 21, end: 23, type: 'gap' },
        { start: 30, end: 33, type: 'gap' },
      ],
    });
  });

  it('CRP-030: labels page breaks by signature, counted from the printed signatures', () => {
    expect(pageBreaks).toStrictEqual([
      { nodeId: nodes[0]?.id, offset: 0, label: 'sig. B1r' },
      { nodeId: nodes[4]?.id, offset: 0, label: 'sig. B1v' },
      {
        nodeId:
          divisions[1]?.scenes[0]?.blocks[0]?.type === 'speech'
            ? divisions[1].scenes[0].blocks[0].nodes[0]?.id
            : '',
        offset: 0,
        label: 'sig. B2r',
      },
    ]);
    expect(misprintedSignatures).toStrictEqual([]);
  });

  it('CRP-024: allocates IDs in reading order from the ID map', () => {
    expect(nodes.map((n) => n.id)).toStrictEqual(
      Array.from({ length: nodes.length }, (_, i) => `ham-q2-${String(i + 1).padStart(5, '0')}`),
    );
  });
});
