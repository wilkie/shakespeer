import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import type { LineNode, TextNode, VersionDocument } from '@shakespeer/corpus';

import { AppProviders } from '@/app/AppProviders';

import { PlayText } from './PlayText';

const verse = (id: string, text: string, n: string, part?: LineNode['part']): LineNode => ({
  id,
  kind: 'line',
  text,
  form: 'verse',
  n,
  ...(part ? { part } : {}),
});

function doc(...speeches: { label: string; nodes: TextNode[] }[]): VersionDocument {
  return {
    schemaVersion: 1,
    playId: 'hamlet',
    versionId: 'folger',
    revision: 'sha256:0000000000000000',
    characters: [],
    divisions: [
      {
        n: 3,
        editorial: false,
        scenes: [
          {
            id: '3.4',
            kind: 'scene',
            n: 4,
            editorial: false,
            blocks: speeches.map(({ label, nodes }) => ({
              type: 'speech',
              speakers: [],
              label,
              nodes,
            })),
          },
        ],
      },
    ],
  };
}

function renderText(version: VersionDocument) {
  return render(<PlayText doc={version} decorations={new Map()} revealTerms={false} />, {
    wrapper: AppProviders,
  });
}

describe('PlayText', () => {
  it('RDR-024: joins a turned-over line within a speech into one row, keeping its nodes', () => {
    const { container } = renderText(
      doc({
        label: 'POLONIUS',
        nodes: [
          verse('ftln-1', 'Tell him his pranks have been too broad to bear', '3.4.4', 'initial'),
          verse('ftln-2', 'with', '3.4.5', 'final'),
          verse('ftln-3', 'And that your Grace hath screened and stood', '3.4.6'),
        ],
      }),
    );

    const rows = [...container.querySelectorAll('.verse-row')];
    expect(rows.map((row) => row.textContent)).toStrictEqual([
      'Tell him his pranks have been too broad to bear 5with',
      'And that your Grace hath screened and stood',
    ]);
    expect(rows[0]?.querySelectorAll('[data-node-id]')).toHaveLength(2);
    expect(container.querySelector('.ghost')).toBeNull();
  });

  it('RDR-024: still indents a line shared between speakers', () => {
    const { container } = renderText(
      doc(
        {
          label: 'MIRANDA',
          nodes: [verse('ftln-1', 'Concluding “Stay. Not yet.”', '1.2.45', 'initial')],
        },
        { label: 'PROSPERO', nodes: [verse('ftln-2', 'The hour’s now come.', '1.2.46', 'final')] },
      ),
    );

    expect(container.querySelector('.ghost')?.textContent).toBe('Concluding “Stay. Not yet.”');
  });

  it('RDR-022: shows a heading qualifier beside the speaker, as a selectable direction', () => {
    const { container } = renderText(
      doc({
        label: 'HAMLET',
        nodes: [
          { id: 'stg-1', kind: 'sd', text: ', within', sdType: 'delivery' },
          verse('ftln-1', 'Mother, mother, mother!', '3.4.7'),
        ],
      }),
    );

    const speaker = container.querySelector('.speaker');
    expect(speaker?.textContent).toBe('HAMLET, within');
    expect(speaker?.querySelector('[data-node-id="stg-1"]')).not.toBeNull();
    expect(container.querySelectorAll('.sd')).toHaveLength(0);
  });
});
