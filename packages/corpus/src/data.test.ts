/**
 * Validates the committed corpus (CRP-003): every file matches its schema, the published JSON
 * Schemas are current, IDs and revisions are consistent, and alignments are complete.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import { computeRevision, textNodes } from '../ingest/lib/revision.ts';
import { alignmentLoaders, versionLoaders } from './generated/loaders';
import {
  AlignmentFileSchema,
  PlayIndexSchema,
  SourcesFileSchema,
  VersionDocumentSchema,
  type VersionDocument,
} from './schema';

const root = join(import.meta.dirname, '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
const loadDoc = (playId: string, versionId: string): VersionDocument =>
  VersionDocumentSchema.parse(readJson(join('plays', playId, `${versionId}.json`)));
const sorted = (ids: string[]) => [...ids].sort();

const index = PlayIndexSchema.parse(readJson('plays.json'));
const sources = SourcesFileSchema.parse(readJson('sources.json'));
const versions = index.plays.flatMap((play) =>
  play.versions.map((version) => [`${play.id}/${version.id}`, play, version] as const),
);
const originals = versions.filter(([, , version]) => version.kind === 'original');

describe('committed corpus', () => {
  it('CRP-003: published JSON Schemas match the schema definitions', () => {
    const schemas = {
      'sources.schema.json': SourcesFileSchema,
      'plays.schema.json': PlayIndexSchema,
      'version.schema.json': VersionDocumentSchema,
      'alignment.schema.json': AlignmentFileSchema,
    };
    for (const [file, schema] of Object.entries(schemas)) {
      expect(readJson(join('schema', file))).toStrictEqual(z.toJSONSchema(schema));
    }
  });

  it('CRP-080: every version names registered sources', () => {
    const ids = new Set(sources.sources.map((source) => source.id));
    for (const [, , version] of versions) {
      for (const sourceId of version.sourceIds) {
        expect(ids).toContain(sourceId);
      }
    }
  });

  it('CRP-005: every version, and every original version alignment, has a loader', () => {
    for (const [key] of versions) {
      expect(versionLoaders[key]).toBeDefined();
    }
    for (const [key] of originals) {
      expect(alignmentLoaders[key]).toBeDefined();
    }
  });
});

describe.each(versions)('%s', (_key, play, version) => {
  const doc = loadDoc(play.id, version.id);
  const nodes = textNodes(doc);

  it('CRP-020: is a valid version document for this play and version', () => {
    expect([doc.playId, doc.versionId]).toStrictEqual([play.id, version.id]);
  });

  it('CRP-024: text node IDs are unique', () => {
    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
  });

  it('CRP-025: revision matches the text', () => {
    expect(doc.revision).toBe(computeRevision(doc));
  });

  it('CRP-023: marks lie within their text', () => {
    const outside = nodes.filter((node) =>
      (node.marks ?? []).some((mark) => mark.end > node.text.length || mark.start >= mark.end),
    );
    expect(outside).toStrictEqual([]);
  });

  it('CRP-022: text is NFC-normalized and trimmed', () => {
    const unnormalized = nodes.filter((node) => node.text !== node.text.normalize('NFC').trim());
    expect(unnormalized).toStrictEqual([]);
  });

  it('CRP-040/041: line numbers are unique', () => {
    const numbers = nodes.flatMap((node) => (node.kind === 'line' && node.n ? [node.n] : []));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('CRP-033: speakers refer to listed characters', () => {
    const characters = new Set(doc.characters.map((character) => character.id));
    const speakers = doc.divisions.flatMap((act) =>
      act.scenes.flatMap((scene) =>
        scene.blocks.flatMap((block) => (block.type === 'speech' ? block.speakers : [])),
      ),
    );
    expect(speakers.filter((speaker) => !characters.has(speaker))).toStrictEqual([]);
  });
});

describe.each(originals)('%s alignment', (_key, play, version) => {
  it('CRP-050: maps every node of both versions exactly once', () => {
    const doc = loadDoc(play.id, version.id);
    const modern = loadDoc(play.id, play.modernVersionId);
    const alignment = AlignmentFileSchema.parse(
      readJson(join('plays', play.id, 'alignment', `${version.id}.json`)),
    );

    expect(alignment.revisions).toStrictEqual({ orig: doc.revision, modern: modern.revision });
    expect(sorted(alignment.entries.flatMap((entry) => entry.orig))).toStrictEqual(
      sorted(textNodes(doc).map((node) => node.id)),
    );
    expect(sorted(alignment.entries.flatMap((entry) => entry.modern))).toStrictEqual(
      sorted(textNodes(modern).map((node) => node.id)),
    );
  });
});
