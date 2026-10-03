/**
 * Permanent text node IDs for sources without their own (CRP-024). The committed map records,
 * for each node's structural key, the ID it was given and a hash of its text, so re-ingestion
 * keeps IDs and reports nodes whose text changed.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

interface IdMapFile {
  prefix: string;
  next: number;
  ids: Record<string, { id: string; hash: string }>;
}

export class IdMap {
  readonly #file: IdMapFile;
  readonly #used = new Set<string>();
  readonly changed: string[] = [];
  readonly added: string[] = [];

  private constructor(file: IdMapFile) {
    this.#file = file;
  }

  /** An empty map, for tests. */
  static empty(prefix: string): IdMap {
    return new IdMap({ prefix, next: 1, ids: {} });
  }

  static async load(path: string, prefix: string): Promise<IdMap> {
    try {
      return new IdMap(JSON.parse(await readFile(path, 'utf8')) as IdMapFile);
    } catch {
      return new IdMap({ prefix, next: 1, ids: {} });
    }
  }

  /** The ID for the node with this structural key, allocating one on first sight. */
  get(key: string, text: string): string {
    if (this.#used.has(key)) {
      throw new Error(`Duplicate node key ${key}`);
    }
    this.#used.add(key);
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 12);
    const existing = this.#file.ids[key];
    if (existing) {
      if (existing.hash !== hash) {
        existing.hash = hash;
        this.changed.push(existing.id);
      }
      return existing.id;
    }
    const id = `${this.#file.prefix}-${String(this.#file.next).padStart(5, '0')}`;
    this.#file.next += 1;
    this.#file.ids[key] = { id, hash };
    this.added.push(id);
    return id;
  }

  /** Keys that were in the map but not seen in this run: their nodes disappeared. */
  get removed(): string[] {
    return Object.entries(this.#file.ids)
      .filter(([key]) => !this.#used.has(key))
      .map(([, { id }]) => id);
  }

  async save(path: string): Promise<void> {
    // One entry per line, in ID order: compact, and diffs show exactly which IDs changed.
    const entries = Object.entries(this.#file.ids)
      .sort(([, a], [, b]) => a.id.localeCompare(b.id))
      .map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
    const header = `  "prefix": ${JSON.stringify(this.#file.prefix)},\n  "next": ${String(this.#file.next)},\n`;
    await writeFile(path, `{\n${header}  "ids": {\n${entries.join(',\n')}\n  }\n}\n`);
  }
}
