import { beforeAll, describe, expect, it } from '@jest/globals';
import { createVersionIndex, loadVersion, type TextAnchor } from '@shakespeer/corpus';
import { saveNote, type AnnotationRecord } from '@shakespeer/storage';
import { screen, waitFor, within } from '@testing-library/react';

import { makeAnchor } from '@/features/reader/anchors';
import { getDatabase } from '@/lib/storage';
import { renderRoute } from '@/test/render';
import { select } from '@/test/selection';

const SLOW = { timeout: 5000 };

let boatswain: TextAnchor;

function annotation(anchor: TextAnchor, notes: string): AnnotationRecord {
  return {
    id: crypto.randomUUID(),
    playId: 'the-tempest',
    versionId: 'folger',
    anchor,
    origin: { kind: 'own' },
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
    color: 'green',
    notes,
    links: [],
    citations: [],
  };
}

async function openReader() {
  const result = renderRoute('/plays/the-tempest/folger');
  await screen.findByRole('heading', { name: 'Act 1, Scene 1', level: 2 }, { timeout: 30000 });
  return result;
}

const highlighted = () => [...document.querySelectorAll('.hl')].map((el) => el.textContent);

// The tests share one database and build on each other, in order.
describe('note counts, unattached notes and definition sources', () => {
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
    const db = await getDatabase();
    await saveNote(db, 'annotations', annotation(boatswain, 'Attached'));
    // Text that is nowhere in the play: unattached (ANC-032).
    const lost = { ...boatswain, quote: { ...boatswain.quote, exact: 'Nowhere in the play' } };
    await saveNote(db, 'annotations', annotation(lost, 'Lost'));
  });

  it('SEL-006: play entries count their notes', async () => {
    renderRoute('/');
    const tempest = (
      await screen.findByRole('heading', { name: 'The Tempest' }, { timeout: 30000 })
    ).closest('li');
    expect(
      await within(tempest as HTMLElement).findByText('2 notes', undefined, SLOW),
    ).toBeInTheDocument();
  });

  it('RDR-042: the version switcher counts each version’s notes', async () => {
    const { user } = await openReader();
    await user.click(screen.getByRole('button', { name: /^Version: .* Change version$/ }));
    const menu = await screen.findByRole('menu');
    expect(
      await within(menu).findByText('Modern spelling · 2 notes', undefined, SLOW),
    ).toBeInTheDocument();
    expect(within(menu).getByText('Original spelling')).toBeInTheDocument();
  });

  it('ANC-032: an unattached note can be attached to the selected text', async () => {
    const { user } = await openReader();
    await waitFor(() => {
      expect(highlighted()).toContain('Boatswain');
    }, SLOW);
    select('mariners');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unattached notes (1)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Unattached notes' });
    expect(within(dialog).getByText('“Nowhere in the play”')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Attach to selection' }));

    await waitFor(() => {
      expect(highlighted()).toContain('mariners');
    }, SLOW);
    expect(within(dialog).getByText('Every note is attached to its text.')).toBeInTheDocument();
  });

  it('DEF-012: switching a definition source off hides its terms', async () => {
    const { user } = await openReader();
    const terms = () => document.querySelectorAll('.term').length;
    await waitFor(() => {
      expect(terms()).toBeGreaterThan(0);
    }, SLOW);
    const all = terms();
    const toggle = async (name: string) => {
      await user.click(screen.getByRole('button', { name: 'More actions' }));
      const item = await screen.findByRole('menuitemcheckbox', { name });
      await user.click(item);
      await user.keyboard('{Escape}');
    };

    await toggle('Schmidt');
    await waitFor(() => {
      expect(terms()).toBeLessThan(all);
    }, SLOW);
    expect(terms()).toBeGreaterThan(0); // Onions' terms remain
    await toggle('Onions');
    await waitFor(() => {
      expect(terms()).toBe(0);
    }, SLOW);

    await toggle('Schmidt');
    await toggle('Onions');
    await waitFor(() => {
      expect(terms()).toBe(all);
    }, SLOW);
  });
});
