import { describe, expect, it } from '@jest/globals';

import { convertFolger } from './folger.ts';

const w = (text: string, n = '') => `<w${n ? ` n="${n}"` : ''}>${text}</w>`;
const c = '<c> </c>';

function tei(body: string): string {
  return `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><profileDesc><particDesc>
    <person xml:id="Prospero_Tmp"><persName><name>Prospero</name></persName></person>
    <person xml:id="Miranda_Tmp"><persName><name>Miranda</name></persName></person>
    <listPerson><person xml:id="SPIRITS.Juno_Tmp" corresp="#SPIRITS_Tmp"/></listPerson>
  </particDesc></profileDesc></teiHeader><text><body>${body}</body></text></TEI>`;
}

describe('convertFolger', () => {
  const result = convertFolger(
    tei(`
    <div1 type="act" n="1"><head>${w('ACT')}</head>
      <div2 type="scene" n="2"><head>${w('Scene')}</head>
        <stage xml:id="stg-0001" type="entrance">${w('Enter')}${c}${w('Prospero')}<lb/>${w('and')}${c}${w('Miranda')}<pc>.</pc></stage>
        <sp who="#Prospero_Tmp"><speaker>${w('PROSPERO')}</speaker><ab>
          <milestone unit="ftln" xml:id="ftln-0010" n="1.2.10" ana="#verse" next="#ftln-0011"/>
          ${w('Concluding')}${c}<q>${w('Stay')}<pc>.</pc></q>
          <stage xml:id="stg-0002" type="delivery">${w('To')}${c}${w('Miranda')}<pc>.</pc></stage>
          ${c}${w('Not')}${c}${w('yet')}
          <milestone edRef="#print #adobe" unit="ftln" xml:id="ftln-0010a" n="1.2.10" ana="#verse"/>
          <app from="#w1"><rdg wit="#print #adobe">old</rdg></app>
          <stage xml:id="stg-0003" type="delivery"><w></w></stage>
        </ab></sp>
        <sp who="#Miranda_Tmp"><speaker>${w('MIRANDA')}</speaker><ab>
          <milestone unit="ftln" xml:id="ftln-0011" n="1.2.11" ana="#verse" prev="#ftln-0010"/>
          ${w('Certainly')}<pc>,</pc>${c}${w('sir')}<pc>.</pc>
          <seg type="song"><milestone unit="ftln" xml:id="ftln-0012" n="1.2.12" ana="#verse"/>
          ${w('Full')}${c}${w('fathom')}${c}${w('five')}</seg>
          <milestone unit="ftln" xml:id="ftln-0013" n="1.2.13" ana="#prose"/>
          ${w('A')}${c}${w('<gap/>')}${c}${w('<hi rend="italic">as</hi>es')}
        </ab></sp>
      </div2>
      <div2 type="epilogue"><head>${w('EPILOGUE')}</head>
        <sp who="#SPIRITS.Juno_Tmp"><ab><milestone unit="ftln" xml:id="ftln-0100" ana="#verse"/>${w('Now', 'EPI.1')}</ab></sp>
      </div2>
    </div1>
    <div1 type="preface" n="preface"><ab>${w('Eternal')}</ab></div1>`),
  );
  const scene = result.divisions[0]?.scenes[0];
  const [entrance, prospero, miranda] = scene?.blocks ?? [];

  it('CRP-020: builds acts and scenes, with prologues/epilogues as scene kinds', () => {
    expect(result.divisions).toHaveLength(1);
    expect(result.divisions[0]?.scenes.map((s) => [s.id, s.kind, s.n])).toStrictEqual([
      ['1.2', 'scene', 2],
      ['1.epilogue', 'epilogue', null],
    ]);
  });

  it('reads characters, naming group members from their IDs', () => {
    expect(result.characters).toStrictEqual([
      { id: 'prospero', name: 'Prospero' },
      { id: 'miranda', name: 'Miranda' },
      { id: 'spirits-juno', name: 'Spirits Juno' },
    ]);
  });

  it('CRP-024: keeps Folger IDs and treats line breaks in stage directions as spaces', () => {
    expect(entrance).toStrictEqual({
      type: 'sd',
      node: { id: 'stg-0001', kind: 'sd', text: 'Enter Prospero and Miranda.', sdType: 'entrance' },
    });
  });

  it('CRP-022: splits speeches into lines with numbers, forms and split-line parts', () => {
    expect(prospero).toStrictEqual({
      type: 'speech',
      speakers: ['prospero'],
      label: 'PROSPERO',
      nodes: [
        {
          id: 'ftln-0010',
          kind: 'line',
          text: 'Concluding “Stay.” Not yet',
          form: 'verse',
          part: 'initial',
          n: '1.2.10',
        },
        { id: 'stg-0002', kind: 'sd', text: 'To Miranda.', sdType: 'delivery', inlineAt: 18 },
      ],
    });
  });

  it('CRP-023: marks songs, gaps and italics without changing the text', () => {
    expect(miranda?.type === 'speech' ? miranda.nodes : []).toStrictEqual([
      {
        id: 'ftln-0011',
        kind: 'line',
        text: 'Certainly, sir.',
        form: 'verse',
        part: 'final',
        n: '1.2.11',
      },
      {
        id: 'ftln-0012',
        kind: 'line',
        text: 'Full fathom five',
        marks: [{ start: 0, end: 16, type: 'song' }],
        form: 'verse',
        n: '1.2.12',
      },
      {
        id: 'ftln-0013',
        kind: 'line',
        text: 'A • ases',
        marks: [
          { start: 2, end: 3, type: 'gap' },
          { start: 4, end: 6, type: 'italic' },
        ],
        form: 'prose',
        n: '1.2.13',
      },
    ]);
  });

  it('takes a line number from its words when the milestone has none', () => {
    const epilogue = result.divisions[0]?.scenes[1]?.blocks[0];
    expect(epilogue?.type === 'speech' ? epilogue.nodes[0] : undefined).toMatchObject({
      n: 'EPI.1',
    });
  });
});
