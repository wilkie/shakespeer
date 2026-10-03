# Shakespeer

A web application for reading and exploring the plays of William Shakespeare. Runs entirely in the
browser; data is persisted locally in IndexedDB.

## Requirements

- **Node.js 24 LTS** (see `.nvmrc`; `nvm use` / `fnm use` picks it up)
- **pnpm 12**, via Corepack: `corepack enable` (the exact version is pinned in `package.json`)

## Getting started

```sh
corepack enable
pnpm install
pnpm dev          # http://localhost:5173
```

## Scripts

All scripts run from the repo root and are orchestrated by [Turborepo](https://turborepo.com), which
caches results so unchanged packages are skipped.

| Script               | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `pnpm dev`           | Start the Vite dev server                                      |
| `pnpm build`         | Production build (`apps/web/dist`)                             |
| `pnpm preview`       | Build, then serve the production bundle                        |
| `pnpm test`          | Run all Jest suites                                            |
| `pnpm test:watch`    | Jest in watch mode                                             |
| `pnpm test:coverage` | Jest with coverage                                             |
| `pnpm lint`          | ESLint (type-aware, zero warnings allowed)                     |
| `pnpm typecheck`     | `tsc --noEmit` in every package                                |
| `pnpm format`        | Format everything with Prettier                                |
| `pnpm check`         | Everything CI runs: format check, lint, typecheck, test, build |

To run a script in a single package: `pnpm --filter @shakespeer/web test`.

## Repository layout

```
apps/
  web/                  React app (Vite, MUI, React Router)
    src/
      app/              Providers, layout, route table, router error page
      components/       Reusable UI components
      lib/              App-level services (e.g. the shared database connection)
      pages/            Route components (lazy-loaded, one chunk each)
      theme/            MUI theme (light/dark via CSS variables)
      test/             Jest setup and render helpers
packages/
  storage/              Typed IndexedDB layer (idb) with append-only schema migrations
  eslint-config/        Shared ESLint flat configs (base, react)
  jest-config/          Shared Jest presets (SWC transform, jsdom environment)
  tsconfig/             Shared TypeScript configs
```

Internal packages are consumed as TypeScript source (no build step); Vite and Jest compile them
on the fly.

## Stack and conventions

- **React 19** with the **React Compiler** enabled — no manual `useMemo`/`useCallback` needed.
- **MUI 9** with CSS-variable theming; light/dark/system mode toggle persists automatically.
  Import components by path (`@mui/material/Button`) for fast dev builds.
- **React Router 8** (data router). Add pages in `apps/web/src/app/routes.tsx` using `lazy`.
- **TypeScript 6**, strict, plus `noUncheckedIndexedAccess` and friends. Import app code via the
  `@/` alias (`@/components/...`).
- **IndexedDB** via [`idb`](https://github.com/jakearchibald/idb) in `@shakespeer/storage`. To change
  the schema, add object stores to `ShakespeerSchema` and **append** a migration to
  `packages/storage/src/schema.ts` — never edit a shipped migration.
- **Jest 30** running as native ESM with SWC. Import test APIs from `@jest/globals`; mock modules
  with `jest.unstable_mockModule` + dynamic `import()`. `fake-indexeddb` is loaded for every test,
  and `apps/web/src/test/render.tsx` provides `renderWithProviders` and `renderRoute` helpers.
- **ESLint 10** flat config: `typescript-eslint` strict type-checked, React Hooks (incl. Compiler
  rules), jsx-a11y strict, and `eslint-config-prettier`.
- **Prettier** formats everything; a Husky pre-commit hook runs it on staged files via
  lint-staged.
- Dependency versions live in one place: the `catalog` in `pnpm-workspace.yaml`. Packages refer
  to them as `"catalog:"`.
