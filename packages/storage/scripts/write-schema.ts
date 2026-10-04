/**
 * Writes the published JSON Schemas of the notes exchange files (XCH-004, XCH-005):
 * `pnpm --filter @shakespeer/storage schema`.
 */
import { writeFile } from 'node:fs/promises';

import { z } from 'zod';

import { CutsFileSchema, NotesFileSchema } from '../src/notes-file.ts';

const schemas = { 'notes-file.v1.json': NotesFileSchema, 'cuts-file.v1.json': CutsFileSchema };
for (const [name, schema] of Object.entries(schemas)) {
  await writeFile(
    new URL(`../schema/${name}`, import.meta.url),
    `${JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2)}\n`,
  );
}
