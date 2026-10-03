/**
 * The notes exchange file (specs/data/exchange-format.md): its schema, reading it from a ZIP
 * archive with size limits, and writing it. Kept free of relative imports so the JSON Schema
 * script can load it directly.
 */
import { PartOfSpeechSchema, TextAnchorSchema } from '@shakespeer/corpus/schema';
import { strToU8, strFromU8, Unzip, UnzipInflate, zipSync } from 'fflate';
import { z } from 'zod';

export const NOTES_FILE_NAME = 'shakespeer-notes.json';
export const NOTES_FORMAT = 'shakespeer-notes';
export const NOTES_FORMAT_VERSION = 1;

/** Limits checked before anything is written (XCH-030). */
export const LIMITS = {
  archiveBytes: 10 * 1024 * 1024,
  jsonBytes: 50 * 1024 * 1024,
  meaning: 5_000,
  notes: 100_000,
} as const;

const CitationNameSchema = z.union([
  z.object({ family: z.string(), given: z.string().optional() }),
  z.object({ literal: z.string() }),
]);

/** CSL-JSON item subset (ANN-004). Unknown types are read as `document`. */
const CitationSchema = z.object({
  type: z.string(),
  title: z.string(),
  author: z.array(CitationNameSchema).optional(),
  issued: z.object({ 'date-parts': z.array(z.array(z.number().int()).min(1).max(3)) }).optional(),
  'container-title': z.string().optional(),
  publisher: z.string().optional(),
  'publisher-place': z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  page: z.string().optional(),
  URL: z.string().optional(),
  DOI: z.string().optional(),
  note: z.string().optional(),
});

const ItemBase = {
  id: z.string().min(1),
  versionId: z.string().min(1),
  anchor: TextAnchorSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const NotesFileDefinitionSchema = z.object({
  ...ItemBase,
  meaning: z.string(),
  partOfSpeech: PartOfSpeechSchema.optional(),
  source: z.string().optional(),
});

export const NotesFileAnnotationSchema = z.object({
  ...ItemBase,
  /** A palette color (ANN-010); unknown colors are read as yellow. */
  color: z.string(),
  notes: z.string(),
  links: z.array(z.object({ url: z.string(), label: z.string().optional() })),
  citations: z.array(CitationSchema),
});

/** `shakespeer-notes.json`, format version 1 (XCH-002). */
export const NotesFileSchema = z.object({
  format: z.literal(NOTES_FORMAT),
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  generator: z.object({ app: z.literal('shakespeer'), version: z.string() }),
  collection: z.object({ name: z.string().trim().min(1) }),
  play: z.object({ id: z.string().min(1) }),
  versions: z.record(z.string(), z.object({ revision: z.string() })),
  definitions: z.array(NotesFileDefinitionSchema),
  annotations: z.array(NotesFileAnnotationSchema),
});

export type NotesFile = z.infer<typeof NotesFileSchema>;
export type NotesFileDefinition = z.infer<typeof NotesFileDefinitionSchema>;
export type NotesFileAnnotation = z.infer<typeof NotesFileAnnotationSchema>;

export class NotesFileError extends Error {
  override name = 'NotesFileError';
}

/**
 * Inflates `shakespeer-notes.json` from a ZIP archive, stopping as soon as it passes the size
 * limit rather than trusting the archive's declared sizes (XCH-001, XCH-030).
 */
function inflateNotesJson(archive: Uint8Array): Uint8Array {
  if (archive.byteLength > LIMITS.archiveBytes) {
    throw new NotesFileError('The file is larger than 10 MB, too large to be a notes file.');
  }
  // Local file header signature: "PK\x03\x04".
  if (archive[0] !== 0x50 || archive[1] !== 0x4b || archive[2] !== 0x03 || archive[3] !== 0x04) {
    throw new NotesFileError(
      'This is not a ZIP file. Notes files are .zip files exported from Shakespeer.',
    );
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  // Set from the unzip callbacks.
  const state: { found: boolean; tooLarge: boolean; failure: Error | null } = {
    found: false,
    tooLarge: false,
    failure: null,
  };
  const unzip = new Unzip((file) => {
    if (file.name !== NOTES_FILE_NAME) {
      return; // Other entries are reserved (XCH-001).
    }
    state.found = true;
    file.ondata = (error, chunk) => {
      if (error) {
        state.failure = error;
        return;
      }
      size += chunk.byteLength;
      if (size > LIMITS.jsonBytes) {
        state.tooLarge = true;
        file.terminate();
        return;
      }
      chunks.push(chunk);
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    unzip.push(archive, true);
  } catch {
    throw new NotesFileError('The ZIP file is damaged and could not be read.');
  }
  if (state.tooLarge) {
    throw new NotesFileError('The notes in this file are larger than 50 MB, too large to import.');
  }
  if (state.failure) {
    throw new NotesFileError('The ZIP file is damaged and could not be read.');
  }
  if (!state.found) {
    throw new NotesFileError(
      `The ZIP file does not contain ${NOTES_FILE_NAME}, so it is not a Shakespeer notes file.`,
    );
  }
  const json = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    json.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return json;
}

/** Reads and validates a notes archive's file (XCH-030). Throws `NotesFileError` with a reason. */
export function readNotesArchive(archive: Uint8Array): NotesFile {
  const bytes = inflateNotesJson(archive);
  let data: unknown;
  try {
    data = JSON.parse(strFromU8(bytes));
  } catch {
    throw new NotesFileError(`${NOTES_FILE_NAME} in the ZIP file is not valid JSON.`);
  }
  const header = z
    .object({ format: z.string().optional(), formatVersion: z.unknown().optional() })
    .safeParse(data);
  if (!header.success || header.data.format !== NOTES_FORMAT) {
    throw new NotesFileError('This is not a Shakespeer notes file.');
  }
  const version = header.data.formatVersion;
  if (typeof version === 'number' && version > NOTES_FORMAT_VERSION) {
    throw new NotesFileError(
      'This file was made by a newer version of Shakespeer. Update the app to import it.',
    );
  }
  const parsed = NotesFileSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.') ?? '';
    throw new NotesFileError(
      `The notes file is incomplete or damaged${where ? ` (at ${where})` : ''}: ${issue?.message ?? 'invalid'}.`,
    );
  }
  return parsed.data;
}

/** Writes a notes archive (XCH-001). */
export function writeNotesArchive(file: NotesFile): Uint8Array {
  return zipSync({ [NOTES_FILE_NAME]: strToU8(JSON.stringify(file, null, 2)) });
}
