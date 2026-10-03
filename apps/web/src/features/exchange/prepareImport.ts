import {
  createVersionIndex,
  getPlay,
  loadVersion,
  type PlayInfo,
  type TextAnchor,
} from '@shakespeer/corpus';
import {
  checkItems,
  findCollection,
  NOTES_FILE_LIMITS,
  NotesFileError,
  readNotesArchive,
  type CheckedNotes,
  type CollectionRecord,
  type NotesFile,
} from '@shakespeer/storage';

import { resolveAnchor } from '@/features/reader/anchors';
import { getDatabase } from '@/lib/storage';

import { readBytes } from './files';

export interface VersionCount {
  versionId: string;
  name: string;
  definitions: number;
  annotations: number;
}

/** Everything the import summary shows before anything is written (IOX-012). */
export interface ImportPlan {
  fileName: string;
  file: NotesFile;
  play: PlayInfo;
  notes: CheckedNotes;
  versions: VersionCount[];
  /** Notes whose text cannot be found in the current corpus (IOX-017). */
  unattached: number;
  /** An imported collection of the same name for the play (IOX-014). */
  existing: CollectionRecord | undefined;
}

async function countUnattached(playId: string, notes: CheckedNotes): Promise<number> {
  const byVersion = new Map<string, TextAnchor[]>();
  for (const item of [...notes.definitions, ...notes.annotations]) {
    byVersion.set(item.versionId, [...(byVersion.get(item.versionId) ?? []), item.anchor]);
  }
  let unattached = 0;
  for (const [versionId, anchors] of byVersion) {
    const index = createVersionIndex(await loadVersion(playId, versionId));
    unattached += anchors.filter((a) => resolveAnchor(index, a).status === 'unattached').length;
  }
  return unattached;
}

/** Reads and checks a chosen file (XCH-030); throws `NotesFileError` with a plain reason. */
export async function prepareImport(file: File): Promise<ImportPlan> {
  if (file.size > NOTES_FILE_LIMITS.archiveBytes) {
    throw new NotesFileError('The file is larger than 10 MB, too large to be a notes file.');
  }
  const notesFile = readNotesArchive(await readBytes(file));
  const play = getPlay(notesFile.play.id);
  if (!play) {
    throw new NotesFileError(
      `These notes are for a play that is not in Shakespeer (“${notesFile.play.id}”).`,
    );
  }
  const notes = checkItems(notesFile, new Set(play.versions.map((v) => v.id)));
  const versions = play.versions
    .map((version) => ({
      versionId: version.id,
      name: version.name,
      definitions: notes.definitions.filter((d) => d.versionId === version.id).length,
      annotations: notes.annotations.filter((a) => a.versionId === version.id).length,
    }))
    .filter((count) => count.definitions + count.annotations > 0);
  const [unattached, existing] = await Promise.all([
    countUnattached(play.id, notes),
    getDatabase().then((db) => findCollection(db, play.id, notesFile.collection.name)),
  ]);
  return { fileName: file.name, file: notesFile, play, notes, versions, unattached, existing };
}
