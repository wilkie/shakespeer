/**
 * Read-only access to the corpus (STO-031). The play index and sources are bundled; each
 * version and alignment loads lazily as its own chunk (CRP-005).
 */
import playIndexData from '../plays.json' with { type: 'json' };
import sourcesData from '../sources.json' with { type: 'json' };
import {
  alignmentLoaders,
  definitionLoaders,
  variantLoaders,
  versionLoaders,
} from './generated/loaders';
import type {
  AlignmentFile,
  PlayIndex,
  PlayInfo,
  Source,
  SourcedDefinitionsFile,
  SourcesFile,
  VariantsFile,
  VersionDocument,
  VersionInfo,
} from './schema';

export type * from './schema';
export { createVersionIndex, type IndexedScene, type VersionIndex } from './version-index';
export { wordKey, wordSpans } from './words';

const playIndex = playIndexData as PlayIndex;
const sources = (sourcesData as SourcesFile).sources;

export class CorpusNotFoundError extends Error {
  override readonly name = 'CorpusNotFoundError';
}

export function listPlays(): readonly PlayInfo[] {
  return playIndex.plays;
}

export function getPlay(playId: string): PlayInfo | undefined {
  return playIndex.plays.find((play) => play.id === playId);
}

export function getVersionInfo(playId: string, versionId: string): VersionInfo | undefined {
  return getPlay(playId)?.versions.find((version) => version.id === versionId);
}

export function getSources(): readonly Source[] {
  return sources;
}

export function getSource(sourceId: string): Source | undefined {
  return sources.find((source) => source.id === sourceId);
}

export async function loadVersion(playId: string, versionId: string): Promise<VersionDocument> {
  const load = versionLoaders[`${playId}/${versionId}`];
  if (!load) {
    throw new CorpusNotFoundError(`No version ${versionId} of ${playId}`);
  }
  return (await load()).default as VersionDocument;
}

/** The alignment of an original version to its play's modern version (CRP-050). */
export async function loadAlignment(
  playId: string,
  versionId: string,
): Promise<AlignmentFile | undefined> {
  const load = alignmentLoaders[`${playId}/${versionId}`];
  return load ? ((await load()).default as AlignmentFile) : undefined;
}

/** All sourced definitions for a version, one file per source (CRP-070). */
export async function loadSourcedDefinitions(
  playId: string,
  versionId: string,
): Promise<SourcedDefinitionsFile[]> {
  const loaders = definitionLoaders[`${playId}/${versionId}`] ?? [];
  const files = await Promise.all(loaders.map((load) => load()));
  return files.map((file) => file.default as SourcedDefinitionsFile);
}

/** A play's curated variants (CRP-060); none for a play without any. */
export async function loadVariants(playId: string): Promise<VariantsFile> {
  const load = variantLoaders[playId];
  return load
    ? ((await load()).default as VariantsFile)
    : { schemaVersion: 1, playId, variants: [] };
}
