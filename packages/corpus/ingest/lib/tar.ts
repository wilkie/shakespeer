/** Reads the regular files of a gzipped tar archive (ustar), for sources published that way. */
import { gunzipSync } from 'fflate';

export function readTarGz(data: Uint8Array): Map<string, Uint8Array> {
  const tar = gunzipSync(data);
  const files = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  const field = (offset: number, length: number) =>
    decoder.decode(tar.subarray(offset, offset + length)).replace(/\0.*$/s, '');
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const name = field(offset, 100);
    if (name === '') {
      break; // End-of-archive blocks.
    }
    const size = parseInt(field(offset + 124, 12).trim() || '0', 8);
    const type = field(offset + 156, 1);
    const prefix = field(offset + 345, 155);
    const body = offset + 512;
    if (type === '0' || type === '') {
      files.set(prefix ? `${prefix}/${name}` : name, tar.subarray(body, body + size));
    }
    offset = body + Math.ceil(size / 512) * 512;
  }
  return files;
}
