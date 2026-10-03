/**
 * Writes the published JSON Schema of the notes exchange file (XCH-004):
 * `pnpm --filter @shakespeer/storage schema`.
 */
import { writeFile } from 'node:fs/promises';

import { z } from 'zod';

import { NotesFileSchema } from '../src/notes-file.ts';

const url = new URL('../schema/notes-file.v1.json', import.meta.url);
await writeFile(
  url,
  `${JSON.stringify(z.toJSONSchema(NotesFileSchema, { io: 'input' }), null, 2)}\n`,
);
