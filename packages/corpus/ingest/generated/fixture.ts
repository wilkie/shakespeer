/** A small modern version and its glossary files, for the generated-definitions tests. */
import type {
  LineNode,
  SourcedDefinitionsFile,
  SourcedTerm,
  VersionDocument,
} from '../../src/schema.ts';

const line = (n: number, text: string): LineNode => ({
  id: `ftln-${String(n).padStart(4, '0')}`,
  kind: 'line',
  text,
  form: 'verse',
  n: `1.1.${String(n)}`,
});

export const doc: VersionDocument = {
  schemaVersion: 1,
  playId: 'the-tempest',
  versionId: 'folger',
  revision: 'sha256:0000000000000000',
  characters: [
    { id: 'Gonzalo_Tmp', name: 'Gonzalo' },
    { id: 'Ariel_Tmp', name: 'Ariel' },
  ],
  divisions: [
    {
      n: 1,
      editorial: false,
      scenes: [
        {
          id: '1.1',
          kind: 'scene',
          n: 1,
          editorial: false,
          blocks: [
            {
              type: 'sd',
              node: { id: 'sd-1.1.0', kind: 'sd', text: 'Enter mariners yarely.' },
            },
            {
              type: 'speech',
              speakers: ['Prospero_Tmp'],
              label: 'PROSPERO',
              nodes: [
                line(1, 'Good Gonzalo, be yare and tend the master.'),
                line(2, 'Yare, yare! Take in the topsail.'),
                line(3, 'Still vexed? The Bermoothes are far.'),
                line(4, 'Thou art still a fool, I think.'),
                line(5, 'Whither go’st thou? Whither wilt thou?'),
                line(6, 'Ariel, thou wast my armèd slave.'),
                line(7, 'Our master, sweet, in Act II.'),
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** Words the tests treat as common modern English. */
export const common = new Set(
  'good be and tend the master take in vex are far still thou art fool think go my arm slave our sweet act'.split(
    ' ',
  ),
);

const term = (sourceId: string, nodeId: string, word: string): SourcedTerm => {
  const text = (doc.divisions[0]?.scenes[0]?.blocks ?? [])
    .flatMap((b) => (b.type === 'speech' ? b.nodes : []))
    .find((node) => node.id === nodeId)?.text as string;
  const start = text.indexOf(word);
  return {
    id: `${sourceId}:${nodeId}:${String(start)}`,
    anchor: {
      start: { nodeId, offset: start },
      end: { nodeId, offset: start + word.length },
      quote: { exact: word, prefix: '', suffix: '' },
      revision: doc.revision,
    },
    headword: word,
    definitions: [{ meaning: `a gloss of ${word}` }],
  };
};

const file = (sourceId: string, terms: SourcedTerm[]): SourcedDefinitionsFile => ({
  schemaVersion: 1,
  playId: 'the-tempest',
  versionId: 'folger',
  sourceId,
  terms,
});

export const sourced = [
  // Schmidt glosses nearly every word: its headwords do not make candidates.
  file('schmidt-1902', [
    term('schmidt-1902', 'ftln-0002', 'topsail'),
    term('schmidt-1902', 'ftln-0001', 'master'),
  ]),
  file('onions-1919', [term('onions-1919', 'ftln-0004', 'still')]),
];
