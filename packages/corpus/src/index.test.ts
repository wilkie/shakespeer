import { describe, expect, it } from '@jest/globals';

import {
  CorpusNotFoundError,
  createVersionIndex,
  getPlay,
  getSource,
  getVersionInfo,
  listPlays,
  loadAlignment,
  loadSourcedDefinitions,
  loadVersion,
} from './index';

describe('corpus API', () => {
  it('lists the first-release plays', () => {
    expect(listPlays().map((play) => play.id)).toStrictEqual([
      'hamlet',
      'the-tempest',
      'troilus-and-cressida',
    ]);
    expect(getPlay('the-tempest')?.title).toBe('The Tempest');
    expect(getVersionInfo('the-tempest', 'f1-1623')?.kind).toBe('original');
    expect(getSource('folger')?.license.commercialUse).toBe(false);
  });

  it('CRP-005: loads a version lazily', async () => {
    const doc = await loadVersion('the-tempest', 'folger');

    expect(doc.playId).toBe('the-tempest');
    expect(doc.divisions).toHaveLength(5);
  });

  it('rejects unknown versions', async () => {
    await expect(loadVersion('the-tempest', 'q9')).rejects.toBeInstanceOf(CorpusNotFoundError);
  });

  it('loads alignments only for original versions', async () => {
    await expect(loadAlignment('the-tempest', 'f1-1623')).resolves.toMatchObject({
      modernVersionId: 'folger',
    });
    await expect(loadAlignment('the-tempest', 'folger')).resolves.toBeUndefined();
  });
});

describe('loadSourcedDefinitions', () => {
  it('CRP-070: loads every source for a version, or none', async () => {
    const files = await loadSourcedDefinitions('the-tempest', 'folger');

    expect(files.map((file) => file.sourceId)).toStrictEqual(['schmidt-1902', 'onions-1919']);
    expect(files[0]?.terms.length).toBeGreaterThan(1000);
    expect(files[1]?.terms.length).toBeGreaterThan(400);
    await expect(loadSourcedDefinitions('the-tempest', 'f1-1623')).resolves.toStrictEqual([]);
  });
});

describe('createVersionIndex', () => {
  it('ANC-003: orders nodes and finds scenes, speeches and line numbers', async () => {
    const index = createVersionIndex(await loadVersion('the-tempest', 'folger'));
    const first = index.lineByNumber('1.1.1');

    expect(first?.text).toBe('Boatswain!');
    const position = index.indexOf(first?.id ?? '');
    expect(position).toBeDefined();
    expect(index.nodes[position ?? -1]).toBe(first);
    expect(index.sceneAt(position ?? -1)?.scene.id).toBe('1.1');
    expect(index.speechOf(first?.id ?? '')?.label).toBe('MASTER');
    expect(index.scenes.map((s) => s.scene.id)).toContain('5.epilogue');
    expect(index.scenes.at(-1)?.end).toBe(index.nodes.length);
  });
});
