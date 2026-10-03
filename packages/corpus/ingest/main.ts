/**
 * Builds the committed corpus from pinned sources (CRP-001 – CRP-006).
 *
 *   pnpm --filter @shakespeer/corpus ingest [--update-lock] [--only <playId>]
 *
 * Downloads sources into the git-ignored `.cache/`, converts them, aligns original versions to
 * the modern version, validates everything against the schemas and writes:
 * `sources.json`, `plays.json`, `plays/<playId>/…`, `schema/*.json` and `src/generated/loaders.ts`.
 * Runs are deterministic and never call a language model or other non-deterministic service.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import {
  AlignmentFileSchema,
  PlayIndexSchema,
  SourcedDefinitionsFileSchema,
  SourcesFileSchema,
  VersionDocumentSchema,
  type AlignmentEntry,
  type AlignmentFile,
  type Character,
  type PlayIndex,
  type TextNode,
  type VersionDocument,
} from '../src/schema.ts';
import { alignVersions } from './align.ts';
import { GLOSSARIES, PLAYS, SOURCES, type GlossaryConfig, type PlayConfig } from './config.ts';
import { applyAlignmentCuration, loadCuration, type Curation } from './curation.ts';
import { supplyEditorialDivisions } from './divisions.ts';
import { convertFolger } from './folger.ts';
import { matchCitations, type GlossCitation, type SceneOffsets } from './glossaries/match.ts';
import { parseOnions } from './glossaries/onions.ts';
import { parseEntries, type Entry } from './glossaries/schmidt.ts';
import { fetchLocked, type LockFile } from './lib/fetch.ts';
import { IdMap } from './lib/ids.ts';
import { computeRevision, textNodes } from './lib/revision.ts';
import { convertTcpPlay } from './tcp.ts';

const ROOT = dirname(import.meta.dirname);
const LOCK_PATH = join(import.meta.dirname, 'sources.lock.json');

const { values: args } = parseArgs({
  options: {
    'update-lock': { type: 'boolean', default: false },
    only: { type: 'string' },
  },
});

const lock = JSON.parse(await readFile(LOCK_PATH, 'utf8')) as LockFile;
const fetchOptions = { cacheDir: join(ROOT, '.cache'), updateLock: args['update-lock'] };
const decoded = new Map<string, string>();

async function source(lockKey: string): Promise<string> {
  const cached = decoded.get(lockKey);
  if (cached !== undefined) {
    return cached;
  }
  const file = lock.files[lockKey];
  if (!file) {
    throw new Error(`No entry ${lockKey} in sources.lock.json`);
  }
  const text = new TextDecoder().decode(await fetchLocked(lockKey, file, fetchOptions));
  decoded.set(lockKey, text);
  return text;
}

async function writeJson(path: string, data: unknown, indent = 1): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, indent || undefined)}\n`);
}

async function readJsonIfExists<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

/**
 * Fills an original version's line numbers (CRP-041) and speakers (CRP-033) from its
 * alignment to the modern version. Speakers follow the original's own speech headings: each
 * printed label is linked to the modern character it most often corresponds to, so speeches
 * the modern editors reassigned keep their original attribution.
 */
function applyAlignment(
  orig: VersionDocument,
  modern: VersionDocument,
  entries: AlignmentEntry[],
  curation: Curation,
): void {
  const modernNodes = new Map(textNodes(modern).map((node) => [node.id, node]));
  const modernSpeakers = new Map<string, string[]>();
  for (const act of modern.divisions) {
    for (const scene of act.scenes) {
      for (const block of scene.blocks) {
        if (block.type === 'speech') {
          for (const node of block.nodes) {
            modernSpeakers.set(node.id, block.speakers);
          }
        }
      }
    }
  }
  const origNodes = new Map(textNodes(orig).map((node) => [node.id, node]));
  const entryOf = new Map<string, AlignmentEntry>();
  const usedNumbers = new Set<string>();

  for (const entry of entries) {
    for (const id of entry.orig) {
      entryOf.set(id, entry);
    }
    const origLines = entry.orig
      .map((id) => origNodes.get(id))
      .filter((node): node is TextNode & { kind: 'line' } => node?.kind === 'line');
    const modernNumbers = entry.modern
      .map((id) => modernNodes.get(id))
      .flatMap((node) => (node?.kind === 'line' && node.n ? [node.n] : []));
    const pairwise = origLines.length === modernNumbers.length;
    origLines.forEach((line, i) => {
      const n = pairwise ? modernNumbers[i] : i === 0 ? modernNumbers[0] : undefined;
      if (n && !usedNumbers.has(n)) {
        usedNumbers.add(n);
        line.n = n;
      }
    });
  }

  const speeches = orig.divisions.flatMap((act) =>
    act.scenes.flatMap((scene) => scene.blocks.filter((block) => block.type === 'speech')),
  );
  const labelKey = (label: string) => label.toLowerCase().replace(/[^a-z]/g, '');
  const tally = (votes: Map<string, number>, block: (typeof speeches)[number]) => {
    for (const node of block.nodes) {
      for (const modernId of entryOf.get(node.id)?.modern ?? []) {
        const speakers = modernSpeakers.get(modernId);
        if (speakers && speakers.length > 0) {
          const key = speakers.join(' ');
          votes.set(key, (votes.get(key) ?? 0) + 1);
        }
      }
    }
  };
  const winner = (votes: Map<string, number>) =>
    [...votes.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
      .split(' ') ?? [];

  const labelVotes = new Map<string, Map<string, number>>();
  for (const block of speeches) {
    const key = labelKey(block.label);
    if (key !== '') {
      const votes = labelVotes.get(key) ?? new Map<string, number>();
      tally(votes, block);
      labelVotes.set(key, votes);
    }
  }
  const used = new Set<string>();
  for (const block of speeches) {
    const key = labelKey(block.label);
    const curated = curation.speakers?.[block.label];
    if (curated) {
      block.speakers = curated;
    } else if (key !== '') {
      block.speakers = winner(labelVotes.get(key) ?? new Map<string, number>());
    } else {
      // No printed heading (e.g. an epilogue): use the aligned modern speech.
      const votes = new Map<string, number>();
      tally(votes, block);
      block.speakers = winner(votes);
    }
    block.speakers.forEach((id) => used.add(id));
  }
  orig.characters = modern.characters
    .filter((character) => used.has(character.id))
    .map((character): Character => ({ ...character, modernId: character.id }));
}

/** Appends a CHANGES.md entry when a version's text changed since the committed output. */
async function recordChanges(
  dir: string,
  previous: VersionDocument | undefined,
  next: VersionDocument,
) {
  if (!previous || previous.revision === next.revision) {
    return;
  }
  const before = new Map(textNodes(previous).map((node) => [node.id, node.text]));
  const after = new Map(textNodes(next).map((node) => [node.id, node.text]));
  const changed = [...after]
    .filter(([id, text]) => before.has(id) && before.get(id) !== text)
    .map(([id]) => id);
  const added = [...after.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const list = (label: string, ids: string[]) =>
    ids.length > 0 ? `- ${label}: ${ids.join(', ')}\n` : '';
  const entry =
    `\n## ${next.versionId}: ${previous.revision} → ${next.revision}\n\n` +
    list('Changed', changed) +
    list('Added', added) +
    list('Removed', removed);
  const path = join(dir, 'CHANGES.md');
  const existing =
    (await readText(path)) ??
    `# Text changes\n\nNode-level changes to committed versions (CRP-025).\n`;
  await writeFile(path, existing + entry);
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

async function ingestPlay(play: PlayConfig): Promise<Map<string, VersionDocument>> {
  const playId = play.info.id;
  const dir = join(ROOT, 'plays', playId);
  console.warn(play.info.title);
  const docs = new Map<string, VersionDocument>();
  const idMaps: { path: string; ids: IdMap }[] = [];

  for (const version of play.versions) {
    const xml = await source(version.source.lockKey);
    let doc: VersionDocument;
    if (version.source.kind === 'folger') {
      const { characters, divisions } = convertFolger(xml);
      doc = {
        schemaVersion: 1,
        playId,
        versionId: version.id,
        revision: '',
        characters,
        divisions,
      };
    } else {
      const path = join(import.meta.dirname, 'ids', `${playId}-${version.id}.json`);
      const ids = await IdMap.load(path, version.source.idPrefix);
      idMaps.push({ path, ids });
      const { divisions, pageBreaks } = convertTcpPlay(xml, { title: version.source.title, ids });
      doc = {
        schemaVersion: 1,
        playId,
        versionId: version.id,
        revision: '',
        characters: [],
        divisions,
        ...(pageBreaks.length > 0 ? { pageBreaks } : {}),
      };
    }
    doc.revision = computeRevision(doc);
    docs.set(version.id, doc);
  }

  const modern = docs.get(play.info.modernVersionId);
  if (!modern) {
    throw new Error(`${playId}: modern version ${play.info.modernVersionId} missing`);
  }
  for (const version of play.versions) {
    const doc = docs.get(version.id) as VersionDocument;
    if (version.kind === 'original') {
      const curation = await loadCuration(ROOT, playId, version.id);
      const { added } = supplyEditorialDivisions(doc, modern, {
        ...(version.source.kind === 'tcp' && version.source.order
          ? { order: version.source.order }
          : {}),
        ...(curation.scenes ? { scenes: curation.scenes } : {}),
      });
      if (added.length > 0) {
        console.warn(`  ${version.id}: ${String(added.length)} editorial scenes (CRP-031)`);
      }
      const entries = applyAlignmentCuration(alignVersions(doc, modern), curation);
      applyAlignment(doc, modern, entries, curation);
      const alignment: AlignmentFile = {
        schemaVersion: 1,
        playId,
        versionId: version.id,
        modernVersionId: modern.versionId,
        revisions: { orig: doc.revision, modern: modern.revision },
        entries,
      };
      await writeJson(
        join(dir, 'alignment', `${version.id}.json`),
        AlignmentFileSchema.parse(alignment),
      );
      const counts: Partial<Record<string, AlignmentEntry[]>> = {};
      for (const entry of entries) {
        (counts[entry.relation] ??= []).push(entry);
      }
      const reviewed = entries.filter((e) => e.status === 'reviewed').length;
      console.warn(
        `  ${version.id} alignment: ${Object.entries(counts)
          .map(([relation, list]) => `${relation} ${String(list?.length ?? 0)}`)
          .join(', ')}; reviewed ${String(reviewed)}/${String(entries.length)}`,
      );
      const unlinked = [
        ...new Set(
          doc.divisions.flatMap((act) =>
            act.scenes.flatMap((scene) =>
              scene.blocks.flatMap((b) =>
                b.type === 'speech' && b.speakers.length === 0 ? [b.label] : [],
              ),
            ),
          ),
        ),
      ];
      if (unlinked.length > 0) {
        console.warn(`  speech headings not linked to a character: ${unlinked.join(', ')}`);
      }
    }
    const path = join(dir, `${version.id}.json`);
    await recordChanges(dir, await readJsonIfExists<VersionDocument>(path), doc);
    await writeJson(path, VersionDocumentSchema.parse(doc));
    console.warn(`  ${version.id}: ${String(textNodes(doc).length)} text nodes, ${doc.revision}`);
  }

  for (const { path, ids } of idMaps) {
    await ids.save(path);
    if (ids.changed.length > 0 || ids.removed.length > 0) {
      console.warn(
        `  IDs: ${String(ids.added.length)} added, ${String(ids.changed.length)} with changed text, ${String(ids.removed.length)} removed`,
      );
    }
  }
  return docs;
}

function loadersModule(index: PlayIndex): string {
  const definitionLines = index.plays.flatMap((play) =>
    play.versions.flatMap((version) => {
      const sources = GLOSSARIES.filter(
        (g) => g.playAbbreviations[play.id] && version.id === play.modernVersionId,
      );
      if (sources.length === 0) {
        return [];
      }
      return [
        `  '${play.id}/${version.id}': [`,
        ...sources.map(
          (g) =>
            `    () =>\n      import('../../plays/${play.id}/definitions/${version.id}/${g.sourceId}.json', {\n        with: { type: 'json' },\n      }),`,
        ),
        '  ],',
      ];
    }),
  );
  const entries = index.plays.flatMap((play) =>
    play.versions.map((version) => ({ play, version })),
  );
  const versionLines = entries.map(
    ({ play, version }) =>
      `  '${play.id}/${version.id}': () =>\n    import('../../plays/${play.id}/${version.id}.json', { with: { type: 'json' } }),`,
  );
  const alignmentLines = entries
    .filter(({ version }) => version.kind === 'original')
    .map(
      ({ play, version }) =>
        `  '${play.id}/${version.id}': () =>\n    import('../../plays/${play.id}/alignment/${version.id}.json', { with: { type: 'json' } }),`,
    );
  return [
    '// Generated by ingest/main.ts. Do not edit.',
    '',
    'type Loader = () => Promise<{ default: unknown }>;',
    '',
    'export const versionLoaders: Readonly<Partial<Record<string, Loader>>> = {',
    ...versionLines,
    '};',
    '',
    'export const alignmentLoaders: Readonly<Partial<Record<string, Loader>>> = {',
    ...alignmentLines,
    '};',
    '',
    'export const definitionLoaders: Readonly<Partial<Record<string, readonly Loader[]>>> = {',
    ...definitionLines,
    '};',
    '',
  ].join('\n');
}

const selected = args.only ? PLAYS.filter((play) => play.info.id === args.only) : PLAYS;
if (selected.length === 0) {
  throw new Error(`Unknown play ${args.only ?? ''}`);
}
const modernDocs = new Map<string, VersionDocument>();
for (const play of selected) {
  const docs = await ingestPlay(play);
  const modern = docs.get(play.info.modernVersionId);
  if (modern) {
    modernDocs.set(play.info.id, modern);
  }
}

/** Every glossed citation of one play in a glossary, ready for matching (CRP-071). */
function playCitations(entries: Entry[], abbreviation: string): GlossCitation[] {
  return entries.flatMap((entry) =>
    entry.senses
      .filter((sense) => sense.gloss !== '')
      .flatMap((sense) =>
        sense.citations
          .filter((citation) => citation.play === abbreviation)
          .map((citation) => ({
            headword: entry.headword,
            definition: {
              meaning: sense.gloss,
              ...(entry.partOfSpeech ? { partOfSpeech: entry.partOfSpeech } : {}),
              ...(sense.label ? { sense: sense.label } : {}),
            },
            act: citation.act,
            scene: citation.scene,
            ...(citation.part ? { part: citation.part } : {}),
            line: citation.line,
            quote: citation.quote,
          })),
      ),
  );
}

/** Line offsets learned per play and scene, shared across glossaries (see matchCitations). */
const learnedOffsets = new Map<string, SceneOffsets>();

async function ingestGlossary(glossary: GlossaryConfig): Promise<void> {
  console.warn(glossary.sourceId);
  const entries: Entry[] = [];
  for (const volume of glossary.volumes) {
    const text = await source(volume.lockKey);
    const start = text.search(volume.start);
    const end = volume.end ? text.indexOf(volume.end) : text.length;
    if (start < 0 || end < 0) {
      throw new Error(`${volume.lockKey}: dictionary boundaries not found`);
    }
    const body = text.slice(start, end);
    entries.push(...(glossary.format === 'onions' ? parseOnions(body) : parseEntries(body)));
  }
  console.warn(`  ${String(entries.length)} entries`);
  for (const [playId, doc] of modernDocs) {
    const abbreviation = glossary.playAbbreviations[playId];
    if (!abbreviation) {
      continue;
    }
    const { terms, report, offsets } = matchCitations(
      doc,
      glossary.sourceId,
      playCitations(entries, abbreviation),
      learnedOffsets.get(playId),
    );
    // Later glossaries citing the same numbering reuse what this one learned.
    const known = learnedOffsets.get(playId) ?? new Map<string, [number, number][]>();
    for (const [scene, pairs] of offsets) {
      known.set(scene, [...(known.get(scene) ?? []), ...pairs]);
    }
    learnedOffsets.set(playId, known);
    const reasons = new Map<string, number>();
    for (const { reason } of report.unmatched) {
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    console.warn(
      `  ${playId}: ${String(report.matched)} citations matched to ${String(terms.length)} terms; skipped ${[
        ...reasons,
      ]
        .map(([reason, count]) => `${String(count)} ${reason}`)
        .join(', ')}`,
    );
    const file = SourcedDefinitionsFileSchema.parse({
      schemaVersion: 1,
      playId,
      versionId: doc.versionId,
      sourceId: glossary.sourceId,
      terms,
    });
    // Compact: these files are large and only ever read by machines.
    await writeJson(
      join(ROOT, 'plays', playId, 'definitions', doc.versionId, `${glossary.sourceId}.json`),
      file,
      0,
    );
  }
}

for (const glossary of GLOSSARIES) {
  await ingestGlossary(glossary);
}

const index: PlayIndex = PlayIndexSchema.parse({
  schemaVersion: 1,
  plays: PLAYS.map((play) => ({
    ...play.info,
    versions: play.versions.map(({ source: _source, ...info }) => info),
  })),
});
await writeJson(join(ROOT, 'plays.json'), index, 2);
await writeJson(
  join(ROOT, 'sources.json'),
  SourcesFileSchema.parse({ schemaVersion: 1, sources: SOURCES }),
  2,
);
await writeFile(join(ROOT, 'src', 'generated', 'loaders.ts'), loadersModule(index));

const schemas = {
  'sources.schema.json': SourcesFileSchema,
  'plays.schema.json': PlayIndexSchema,
  'version.schema.json': VersionDocumentSchema,
  'alignment.schema.json': AlignmentFileSchema,
  'definitions.schema.json': SourcedDefinitionsFileSchema,
};
for (const [name, schema] of Object.entries(schemas)) {
  await writeJson(join(ROOT, 'schema', name), z.toJSONSchema(schema), 2);
}

if (args['update-lock']) {
  await writeJson(LOCK_PATH, lock, 2);
}
console.warn('Done.');
