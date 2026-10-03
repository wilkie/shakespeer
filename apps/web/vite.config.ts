import { fileURLToPath } from 'node:url';

import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * The corpus loads JSON with `import(path, { with: { type: 'json' } })`, which native ESM (and
 * Jest) require but Vite's dev server does not handle for dynamic imports; Vite already treats
 * `.json` as a module, so the attribute is dropped here.
 */
function dynamicJsonImports(): Plugin {
  const pattern =
    /import\((['"][^'"]+\.json['"]),\s*\{\s*with:\s*\{\s*type:\s*['"]json['"]\s*,?\s*\}\s*,?\s*\}\s*\)/g;
  return {
    name: 'shakespeer:dynamic-json-imports',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules') || !code.includes("type: 'json'")) {
        return null;
      }
      return { code: code.replace(pattern, 'import($1)'), map: null };
    },
  };
}

/**
 * The path the app is served from. GitHub Pages serves project sites from `/<repo>/`, so the
 * Pages workflow sets BASE_PATH; everywhere else the app is served from the root.
 */
function basePath(): string {
  const base = process.env['BASE_PATH'] ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
}

// https://vite.dev/config/
export default defineConfig({
  base: basePath(),
  plugins: [dynamicJsonImports(), react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2023',
    sourcemap: true,
    // Corpus texts and definitions are large by nature and load lazily, one chunk per version.
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
