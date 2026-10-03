import { describe, expect, it } from '@jest/globals';

import { IdMap } from './lib/ids.ts';
import { convertTcpPlay } from './tcp.ts';

const FOLIO = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
  <div type="play"><head>THE ROMANCE.</head></div>
  <div type="play">
    <pb n="1"/>
    <head>THE TEMPEST.</head>
    <div n="1" type="act"><head>Actus primus,</head>
      <div n="1" type="scene"><head>Scena prima.</head>
        <stage>A tempeſtuous noiſe: En<g ref="char:EOLhyphen"/>ter a Ship-maſter.</stage>
        <sp><speaker>Maſter.</speaker><p><seg rend="decorInit">B</seg>Ote-ſwaine.</p></sp>
        <sp><speaker>Alon.</speaker>
          <p>Good Boteſwain<gap reason="illegible"><desc>•</desc></gap> haue care<g ref="char:punc">▪</g></p>
          <l>Since y<hi rend="sup">u</hi> doſt giue me <hi>Naples,</hi> heaue<g ref="char:cmbAbbrStroke">̄</g>s</l>
          <l><stage>Burthen.</stage>Harke, harke<stage>Exit.</stage> bowgh</l>
          <lg type="song"><head>Song.</head><l>Come vnto theſe yellow ſands,</l></lg>
        </sp>
      </div>
    </div>
    <div n="3" type="act"><head>Actus Tertius.</head>
      <div n="1" type="act"><head>Scoena Prima.</head>
        <pb n="2"/>
        <sp><speaker>Fer.</speaker><l>There be ſome Sports are painfull</l></sp>
      </div>
    </div>
    <div type="epilogue"><head>EPILOGVE.</head><l>NOw my Charmes are all ore-throwne,</l></div>
    <div type="dramatis_personae"><head>Names of the Actors.</head></div>
  </div>
</body></text></TEI>`;

describe('convertTcpPlay', () => {
  const ids = IdMap.empty('tmp-f1');
  const { divisions, pageBreaks } = convertTcpPlay(FOLIO, { title: /TEMPEST/, ids });
  const scene = divisions[0]?.scenes[0];
  const nodes = scene?.blocks.flatMap((b) => (b.type === 'speech' ? b.nodes : [b.node])) ?? [];

  it('CRP-031: classifies divisions by printed heading, fixing mislabeled scenes', () => {
    expect(divisions.map((act) => [act.n, act.heading, act.scenes.map((s) => s.id)])).toStrictEqual(
      [
        [1, 'Actus primus,', ['1.1']],
        [2, 'Actus Tertius.', ['2.1']],
        [null, undefined, ['epilogue']],
      ],
    );
    expect(divisions[1]?.scenes[0]?.heading).toBe('Scoena Prima.');
  });

  it('CRP-030: keeps original spelling, shows long s as s and joins line-end hyphens', () => {
    expect(nodes[0]).toMatchObject({
      kind: 'sd',
      text: 'A tempestuous noise: Enter a Ship-master.',
    });
    expect(nodes[1]).toMatchObject({ kind: 'line', form: 'prose', text: 'BOte-swaine.' });
  });

  it('CRP-032: marks gaps, unreadable punctuation and superscripts; keeps abbreviation strokes', () => {
    expect(nodes[2]).toMatchObject({
      text: 'Good Boteswain• haue care•',
      marks: [
        { start: 14, end: 15, type: 'gap' },
        { start: 25, end: 26, type: 'gap' },
      ],
    });
    expect(nodes[3]).toMatchObject({
      text: 'Since yu dost giue me Naples, heauēs',
      marks: [
        { start: 7, end: 8, type: 'sup' },
        { start: 22, end: 29, type: 'italic' },
      ],
    });
  });

  it('CRP-022: places stage directions inside a line before it or after it with inlineAt', () => {
    expect(
      nodes.slice(4, 7).map((n) => [n.kind, n.text, n.kind === 'sd' ? n.inlineAt : undefined]),
    ).toStrictEqual([
      ['sd', 'Burthen.', undefined],
      ['line', 'Harke, harke bowgh', undefined],
      ['sd', 'Exit.', 12],
    ]);
  });

  it('marks songs and keeps song headings as label directions', () => {
    expect(nodes.slice(7)).toMatchObject([
      { kind: 'sd', text: 'Song.', sdType: 'label' },
      {
        kind: 'line',
        text: 'Come vnto these yellow sands,',
        marks: [{ start: 0, end: 29, type: 'song' }],
      },
    ]);
  });

  it('CRP-024: allocates IDs in reading order from the ID map', () => {
    expect(nodes.map((n) => n.id)).toStrictEqual(
      Array.from({ length: nodes.length }, (_, i) => `tmp-f1-${String(i + 1).padStart(5, '0')}`),
    );
  });

  it('CRP-030: records page breaks', () => {
    const ferdinand = divisions[1]?.scenes[0]?.blocks[0];
    expect(pageBreaks).toStrictEqual([
      { nodeId: 'tmp-f1-00001', offset: 0, label: 'p. 1' },
      {
        nodeId: ferdinand?.type === 'speech' ? ferdinand.nodes[0]?.id : '',
        offset: 0,
        label: 'p. 2',
      },
    ]);
  });
});
