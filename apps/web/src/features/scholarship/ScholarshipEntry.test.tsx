import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ScholarshipFile } from '@shakespeer/corpus';
import type { Citation } from '@shakespeer/storage';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ScholarshipEntry } from './ScholarshipEntry';

const works = Object.fromEntries(
  Array.from({ length: 25 }, (_, i) => [
    `W${String(i)}`,
    {
      id: `W${String(i)}`,
      title: `Reading Caliban ${String(i)}`,
      authors: ['Ann Smith', 'Bo Li', 'Cy Doe', 'Di Ray'],
      year: 2000 + i,
      venue: 'Shakespeare Survey',
      type: 'article',
      oaUrl: `https://example.org/${String(i)}.pdf`,
    },
  ]),
);

const snapshot: ScholarshipFile = {
  schemaVersion: 1,
  playId: 'the-tempest',
  versionId: 'folger',
  retrievedAt: '2026-11-11',
  lines: { L1: Object.keys(works) },
  works,
  reprints: [],
};

const line = { id: 'L1', n: '1.2.396' };
const lines = [line];
const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function renderEntry(overrides: Partial<Parameters<typeof ScholarshipEntry>[0]> = {}) {
  const onCite = jest.fn((_lineId: string, _citation: Citation) =>
    Promise.resolve('created' as const),
  );
  const onSource = jest.fn();
  render(
    <ScholarshipEntry
      lines={lines}
      snapshot={snapshot}
      reprints={[]}
      lookupLines={() => Promise.resolve([{ ...line, phrase: 'This island’s mine by Sycorax' }])}
      onSource={onSource}
      onCite={onCite}
      {...overrides}
    />,
  );
  return { user: userEvent.setup(), onCite, onSource };
}

describe('ScholarshipEntry', () => {
  it('SCH-021/022: lists works with their details, 20 at first, and says where they come from', async () => {
    const { user, onSource } = renderEntry();
    const list = screen.getAllByRole('list')[0] as HTMLElement;
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    // Most recent first; linked to the open-access copy.
    const first = within(list).getAllByRole('link')[0];
    expect(first).toHaveTextContent('Reading Caliban 24');
    expect(first).toHaveAttribute('href', 'https://example.org/24.pdf');
    expect(
      screen.getAllByText(
        'Ann Smith, Bo Li, Cy Doe et al. · 2024 · Shakespeare Survey · Article',
      )[0],
    ).toBeInTheDocument();
    expect(screen.getByText(/From OpenAlex, retrieved 2026-11-11/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'About OpenAlex' }));
    expect(onSource).toHaveBeenCalledWith('openalex');

    await user.click(screen.getByRole('button', { name: 'Show all 25' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(25);
  });

  it('SCH-030: searches OpenAlex on request and lists only what is new', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            results: [
              {
                id: 'https://openalex.org/W24',
                display_name: 'Reading Caliban 24',
                type: 'article',
                primary_topic: { field: { display_name: 'Arts and Humanities' } },
              },
              {
                id: 'https://openalex.org/W99',
                display_name: 'Prospero’s Books',
                publication_year: 2019,
                type: 'book-chapter',
                primary_topic: { field: { display_name: 'Arts and Humanities' } },
              },
            ],
          }),
      } as unknown as Response),
    );
    globalThis.fetch = fetchMock;
    const { user } = renderEntry();
    // Nothing is sent until asked (SCH-031).
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Search OpenAlex now' }));
    expect(await screen.findByRole('heading', { name: 'New from OpenAlex' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prospero’s Books' })).toBeInTheDocument();
    // W24 was already listed from the snapshot.
    expect(screen.getAllByRole('link', { name: 'Reading Caliban 24' })).toHaveLength(1);
  });

  it('SCH-033: explains a failed search and offers to try again', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      } as unknown as Response),
    );
    const { user } = renderEntry({ snapshot: undefined });
    expect(screen.getByText(/Scholarship has not been gathered for this text/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search OpenAlex now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/daily limit/);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('SCH-032: cites a work in a note on its line', async () => {
    const { user, onCite } = renderEntry();
    const list = screen.getAllByRole('list')[0] as HTMLElement;
    await user.click(
      within(list).getAllByRole('button', { name: 'Cite in a note' })[0] as HTMLElement,
    );
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Added to a new note on this line');
    });
    expect(onCite).toHaveBeenCalledWith(
      'L1',
      expect.objectContaining({ title: 'Reading Caliban 24', URL: 'https://example.org/24.pdf' }),
    );
  });
});
