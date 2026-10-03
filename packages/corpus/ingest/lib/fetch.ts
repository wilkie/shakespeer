/**
 * Downloads pinned source files into the git-ignored cache and verifies their hashes (CRP-002).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { unzipSync } from 'fflate';

export interface LockedFile {
  url: string;
  /** SHA-256 of the downloaded file. Empty until first pinned with `--update-lock`. */
  sha256: string;
  /** For zip archives: the member to extract. */
  member?: string;
}

export interface LockFile {
  files: Record<string, LockedFile>;
}

export interface FetchOptions {
  cacheDir: string;
  /** Record hashes for files that have none yet, instead of failing. */
  updateLock: boolean;
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Download failed (${String(response.status)}): ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Returns the file's bytes (or the zip member's bytes), downloading it if not cached. */
export async function fetchLocked(
  key: string,
  file: LockedFile,
  { cacheDir, updateLock }: FetchOptions,
): Promise<Uint8Array> {
  await mkdir(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, `${key}${file.member ? '.zip' : ''}`);

  let data: Uint8Array;
  try {
    data = new Uint8Array(await readFile(cachePath));
  } catch {
    console.warn(`  downloading ${key} from ${file.url}`);
    data = await download(file.url);
    await writeFile(cachePath, data);
  }

  const hash = sha256(data);
  if (!file.sha256) {
    if (!updateLock) {
      throw new Error(`No pinned hash for ${key}; run ingest with --update-lock to pin it.`);
    }
    file.sha256 = hash;
  } else if (file.sha256 !== hash) {
    throw new Error(
      `Hash mismatch for ${key}: expected ${file.sha256}, got ${hash}. ` +
        `The source changed upstream; review it, then re-pin with --update-lock.`,
    );
  }

  if (!file.member) {
    return data;
  }
  const member = file.member;
  const entries = unzipSync(data, { filter: (entry) => entry.name === member });
  const extracted = entries[member];
  if (!extracted) {
    throw new Error(`${key}: zip has no member ${member}`);
  }
  return extracted;
}
