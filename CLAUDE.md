# Shakespeer

pnpm + Turborepo monorepo. React 19 / MUI 9 / React Router 8 / Vite 8 app in `apps/web`; shared
packages in `packages/`. See README.md for layout and conventions.

## Commands (run from repo root)

- `pnpm check` — everything CI runs (format check, lint, typecheck, test, build). Run before committing.
- `pnpm --filter @shakespeer/web test -- src/app/routes.test.tsx` — run a single test file.
- `pnpm format` — fix formatting.

## Specs

Behavior and data are defined in `specs/` (start at `specs/README.md`). Implement only specs
marked `Approved`; change the spec before changing behavior; cite requirement IDs in test names
(`it('RDR-031: …')`). Use the vocabulary in `specs/glossary.md`.

## Rules

- Add dependency versions to the `catalog` in `pnpm-workspace.yaml` and reference them as
  `"catalog:"` in package.json; never pin versions directly in a package.
- Tests run as native ESM: import `describe`/`it`/`expect`/`jest` from `@jest/globals`; use
  `jest.unstable_mockModule`, not `jest.mock`.
- IndexedDB schema changes: append a migration in `packages/storage/src/schema.ts`; never edit
  existing migrations.
- Import MUI components by path (`@mui/material/Button`), and app modules via `@/`.
- React Compiler is on: don't add `useMemo`/`useCallback`/`memo` for performance.
