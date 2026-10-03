/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { transformSync } from '@babel/core';
import { describe, expect, it } from '@jest/globals';
import reactCompiler from 'babel-plugin-react-compiler';

const SRC = join(import.meta.dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry): string[] => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * The app relies on the React Compiler instead of manual memoization (CLAUDE.md), so a
 * component it silently skips re-renders and recomputes freely. That once left the reader's
 * version index unstable, which looped renders and stopped URL tracking (RDR-031).
 */
describe('React Compiler', () => {
  it.each(sources(SRC).map((path) => [path.slice(SRC.length + 1), path]))(
    'compiles %s without skipping anything',
    (_name, path) => {
      const errors: string[] = [];
      transformSync(readFileSync(path, 'utf8'), {
        filename: path,
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ['jsx', 'typescript'] },
        plugins: [
          [
            reactCompiler,
            {
              logger: {
                logEvent: (_file: string, event: { kind: string; detail?: unknown }) => {
                  if (event.kind.includes('Error')) {
                    errors.push(JSON.stringify(event.detail).slice(0, 300));
                  }
                },
              },
            },
          ],
        ],
      });
      expect(errors).toStrictEqual([]);
    },
  );
});
