import { describe, expect, it, jest } from '@jest/globals';
import type { SourcedTerm, TextAnchor } from '@shakespeer/corpus';
import { render, screen } from '@testing-library/react';

import { TermEntry } from './TermEntry';

const anchor: TextAnchor = {
  start: { nodeId: 'ftln-0001', offset: 0 },
  end: { nodeId: 'ftln-0001', offset: 4 },
  quote: { exact: 'yare', prefix: '', suffix: '' },
  revision: 'test',
};

const term = (sourceId: string, meaning: string): { sourceId: string; term: SourcedTerm } => ({
  sourceId,
  term: { id: `${sourceId}:x`, anchor, headword: 'yare', definitions: [{ meaning }] },
});

describe('TermEntry', () => {
  it('GEN-031: generated definitions come last, labelled Generated, with a note they may be wrong', () => {
    render(
      <TermEntry
        anchor={anchor}
        group={{
          key: 'k',
          anchor,
          sourced: [term('generated', 'quick, nimble'), term('schmidt-1902', 'ready, brisk')],
          definitions: [],
        }}
        drafts={[]}
        editing={false}
        focusId={undefined}
        onAddDefinition={jest.fn()}
        onSave={jest.fn()}
        onDelete={jest.fn()}
        onSource={jest.fn()}
      />,
    );
    const meanings = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(meanings).toEqual(['ready, brisk', 'quick, nimble']);
    expect(screen.getByRole('button', { name: 'Generated' }).parentElement).toHaveTextContent(
      'Source: Generated · may be wrong',
    );
    expect(screen.getByRole('button', { name: 'Schmidt' }).parentElement).not.toHaveTextContent(
      'may be wrong',
    );
  });
});
