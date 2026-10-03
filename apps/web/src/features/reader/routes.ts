import {
  getPlay,
  getVersionInfo,
  loadSourcedDefinitions,
  loadVersion,
  type PlayInfo,
  type SourcedDefinitionsFile,
  type VersionDocument,
  type VersionInfo,
} from '@shakespeer/corpus';
import { data, redirect, type LoaderFunctionArgs } from 'react-router';

import { getSettings } from '@/lib/storage';

/** `/plays/:playId` opens the version last used, else the modern version (RDR-041). */
export async function playRedirectLoader({ params }: LoaderFunctionArgs): Promise<Response> {
  const play = getPlay(params['playId'] ?? '');
  if (!play) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's error responses
    throw data('Not found', { status: 404 });
  }
  const last = await (await getSettings()).get(`reader.lastVersion.${play.id}`);
  const versionId = play.versions.some((v) => v.id === last) && last ? last : play.modernVersionId;
  return redirect(`/plays/${play.id}/${versionId}`);
}

export interface ReaderData {
  play: PlayInfo;
  version: VersionInfo;
  doc: VersionDocument;
  definitions: SourcedDefinitionsFile[];
}

/** Loads a version and its sourced definitions; unknown IDs are a 404 (RDR-001). */
export async function readerLoader({ params }: LoaderFunctionArgs): Promise<ReaderData> {
  const play = getPlay(params['playId'] ?? '');
  const version = play && getVersionInfo(play.id, params['versionId'] ?? '');
  if (!play || !version) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's error responses
    throw data('Not found', { status: 404 });
  }
  const [doc, definitions] = await Promise.all([
    loadVersion(play.id, version.id),
    loadSourcedDefinitions(play.id, version.id),
  ]);
  return { play, version, doc, definitions };
}
