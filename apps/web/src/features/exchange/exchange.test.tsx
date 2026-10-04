import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { createVersionIndex, loadVersion, type TextAnchor } from '@shakespeer/corpus';
import {
  deleteNote,
  listNotes,
  readNotesArchive,
  writeNotesArchive,
  type CutsFile,
  type NotesFile,
} from '@shakespeer/storage';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { makeAnchor } from '@/features/reader/anchors';
import { getDatabase } from '@/lib/storage';
import { renderRoute } from '@/test/render';

import { readBytes } from './files';

/** Imports and saves re-render the whole play, which is slow under test. */
const SLOW = { timeout: 5000 };

let boatswain: TextAnchor;

beforeAll(async () => {
  const index = createVersionIndex(await loadVersion('the-tempest', 'folger'));
  const anchor = makeAnchor(
    index,
    { nodeId: 'ftln-0001', offset: 0 },
    { nodeId: 'ftln-0001', offset: 9 },
  );
  if (!anchor) {
    throw new Error('no anchor');
  }
  boatswain = anchor;
});

function notesFile(overrides: Partial<NotesFile> = {}): NotesFile {
  const lost = { ...boatswain, quote: { ...boatswain.quote, exact: 'Nowhere in the play' } };
  return {
    format: 'shakespeer-notes',
    formatVersion: 1,
    exportedAt: '2026-10-03T00:00:00.000Z',
    generator: { app: 'shakespeer', version: 'test' },
    collection: { name: 'Class notes' },
    play: { id: 'the-tempest' },
    versions: { folger: { revision: boatswain.revision } },
    definitions: [
      {
        id: 'd1',
        versionId: 'folger',
        anchor: boatswain,
        meaning: 'Ship’s officer',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'd2',
        versionId: 'q1',
        anchor: boatswain,
        meaning: 'Unknown version',
        createdAt: '',
        updatedAt: '',
      },
    ],
    annotations: [
      {
        id: 'a1',
        versionId: 'folger',
        anchor: lost,
        color: 'pink',
        notes: 'Lost',
        links: [],
        citations: [],
        createdAt: '',
        updatedAt: '',
      },
    ],
    ...overrides,
  };
}

const zipFile = (file: NotesFile, name = 'class-notes.zip', cuts?: CutsFile) =>
  new File([writeNotesArchive(file, cuts) as BlobPart], name, { type: 'application/zip' });

function choose(file: File) {
  fireEvent.change(screen.getByTestId('import-file'), { target: { files: [file] } });
}

// The tests share one database and build on each other, in order: import, update, export.
describe('import and export', () => {
  it('IOX-010/012/013/015/017: imports from play selection, summarizing first, then opens the play', async () => {
    const { user, router } = renderRoute('/');
    await user.click(
      await screen.findByRole('button', { name: 'Import notes…' }, { timeout: 10000 }),
    );
    choose(zipFile(notesFile()));

    const dialog = await screen.findByRole('dialog', { name: 'Import notes' });
    expect(await within(dialog).findByText('Class notes', undefined, SLOW)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 definition, 1 annotation/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 note will be skipped/)).toBeInTheDocument();
    expect(within(dialog).getByText(/text of 1 note could not be found/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByText('2 notes added.', undefined, SLOW)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/plays\/the-tempest/);
    }, SLOW);
  });

  it('IOX-014/016: re-importing offers an update, and imported notes show their collection', async () => {
    const { user } = renderRoute('/plays/the-tempest/folger');
    await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 10000 });

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import notes…' }));
    choose(
      zipFile(
        notesFile({
          definitions: [
            {
              id: 'd1',
              versionId: 'folger',
              anchor: boatswain,
              meaning: 'Petty officer',
              createdAt: '',
              updatedAt: '',
            },
          ],
          annotations: [],
        }),
      ),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Import notes' });
    expect(
      await within(dialog).findByText(
        /already imported a collection named “Class notes”/,
        undefined,
        SLOW,
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Update “Class notes”' }));
    expect(await within(dialog).findByText('1 note updated.', undefined, SLOW)).toBeInTheDocument();
    expect(within(dialog).getByText('1 note removed.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    // The imported definition is on the first "Boatswain!" (PNL-011).
    await waitFor(() => {
      expect(document.querySelector('[data-node-id="ftln-0001"] .term')).not.toBeNull();
    }, SLOW);
    await user.click(document.querySelector('[data-node-id="ftln-0001"] .term') as HTMLElement);
    const panel = await screen.findByRole('complementary', { name: 'Notes' });
    expect(within(panel).getByText('Petty officer')).toBeInTheDocument();
    expect(within(panel).getByText('Class notes')).toBeInTheDocument();
  });

  it('IOX-011: an invalid file changes nothing and says why', async () => {
    const { user } = renderRoute('/');
    await user.click(
      await screen.findByRole('button', { name: 'Import notes…' }, { timeout: 10000 }),
    );
    choose(new File(['not a zip'], 'notes.zip'));

    expect(await screen.findByText(/This is not a ZIP file/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose file…' })).toBeInTheDocument();
  });

  it('IOX-001/002/004: exports the play’s notes as a zip download', async () => {
    let saved: Blob | undefined;
    URL.createObjectURL = jest.fn((blob: Blob) => {
      saved = blob;
      return 'blob:notes';
    });
    URL.revokeObjectURL = jest.fn();
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { user } = renderRoute('/plays/the-tempest/folger');
    await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 10000 });
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export notes…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Export notes' });
    const name = within(dialog).getByRole('textbox', { name: 'Collection name' });
    await waitFor(() => {
      expect(name).toHaveValue('The Tempest notes');
    }, SLOW);
    // Only imported notes so far, which are left out unless asked for.
    expect(
      await within(dialog).findByText(
        'There are no notes to export for this play.',
        undefined,
        SLOW,
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Include imported notes' }));
    expect(
      await within(dialog).findByText(/1 definition and 0 annotations/, undefined, SLOW),
    ).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, 'Shared');
    await user.click(within(dialog).getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(click).toHaveBeenCalled();
    }, SLOW);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^shakespeer-the-tempest-shared-\d{4}-\d{2}-\d{2}\.zip$/);
    const file = readNotesArchive(await readBytes(saved as Blob));
    expect(file.collection.name).toBe('Shared');
    expect(file.definitions.map((d) => d.meaning)).toStrictEqual(['Petty officer']);
    click.mockRestore();
  });

  it('IOX-014a: re-importing offers to restore notes you deleted', async () => {
    const db = await getDatabase();
    const { definitions } = await listNotes(db, 'the-tempest', 'folger');
    const imported = definitions.find((d) => d.origin.kind === 'imported');
    await deleteNote(db, 'definitions', imported?.id ?? '');

    const { user } = renderRoute('/');
    await user.click(
      await screen.findByRole('button', { name: 'Import notes…' }, { timeout: 10000 }),
    );
    choose(
      zipFile(
        notesFile({
          definitions: [
            {
              id: 'd1',
              versionId: 'folger',
              anchor: boatswain,
              meaning: 'Petty officer',
              createdAt: '',
              updatedAt: '',
            },
          ],
          annotations: [],
        }),
      ),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Import notes' });
    await user.click(
      await within(dialog).findByRole('checkbox', { name: 'Restore the 1 note you deleted' }, SLOW),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Update “Class notes”' }));

    expect(
      await within(dialog).findByText('1 note you had deleted restored.', undefined, SLOW),
    ).toBeInTheDocument();
  });

  it('CUT-052: imports cuts with the notes, counted in the summary and report', async () => {
    const { user } = renderRoute('/');
    await user.click(
      await screen.findByRole('button', { name: 'Import notes…' }, { timeout: 10000 }),
    );
    const cuts: CutsFile = {
      format: 'shakespeer-cuts',
      formatVersion: 1,
      play: { id: 'the-tempest' },
      cuts: [
        {
          id: 'k1',
          versionId: 'folger',
          name: 'Class cut',
          createdAt: '',
          updatedAt: '',
          operations: [{ id: 'o1', type: 'hide', anchor: boatswain }],
        },
      ],
    };
    choose(
      zipFile(
        notesFile({ collection: { name: 'Cuts only' }, definitions: [], annotations: [] }),
        'cuts.zip',
        cuts,
      ),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Import notes' });
    expect(
      await within(dialog).findByText(/0 definitions, 0 annotations, 1 cut/, undefined, SLOW),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByText('1 cut added.', undefined, SLOW)).toBeInTheDocument();
  });
});
