# Copilot Instructions

Purpose: Keep changes sharp, informed by the environment, and verified.

## Project quick facts

- Stack: Vite 7 + React 19 + TypeScript 5.8 (ESM, "type": "module").
- Styling/UI: Tailwind CSS 4 (via `@tailwindcss/vite`), shadcn/ui (style: new-york), Radix UI, lucide-react.
- Data/logic: TanStack Query v5, Zod.
- 3D: three + `@react-three/fiber`.
- PWA: `vite-plugin-pwa` + `workbox-window`.
- Testing: Vitest 3 (+ Testing Library), Playwright 1.54 for E2E.
- Lint/format: `oxlint` (ox-standard) + Biome format.
- Package manager: npm (repo has `package-lock.json`).
- Aliases: `@/*` -> `src/*` (tsconfig + Vite resolve alias).
- Key scripts: `dev` (Vite), `build` (tsc -b + vite build), `test` (Vitest), `test:e2e` (Playwright), `lint` (oxlint + biome), utilities in `scripts/` and `bin/`.
- Notable define: `__COMMIT_HASH__` injected from `git rev-parse --short HEAD`.

Layout:
- `src/` app code (components, lib, hooks, stores, types, glsl, __tests__).
- `public/` static assets (icons, sprites, PWA assets, robots, sitemap).
- `scripts/` Node/tsx utilities (icons/OG generation, mappings).
- `docker/` setup and `mgba-docker.ts`; `bin/` CLIs.
- Config: `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `components.json`, `biome.json`.

### Components structure
- `src/components/`
	- `common/`: shared UI primitives and utilities (e.g., `Card.tsx`, `Popover.tsx`, `Skeleton.tsx`, `ScrollableContainer.tsx`, `ShaderBackground.tsx`, `PWAInstallPrompt.tsx`); `index.ts` for re-exports.
	- `pokemon/`: feature components for the editor domain (e.g., `PokemonPartyList.tsx`, `PokemonHeader.tsx`, `PokemonStatus.tsx`, `PokemonMovesSection.tsx`, `PokemonTraitsSection.tsx`, `PokemonNatureCombobox.tsx`, `PokemonTypeBadge.tsx`, `PokemonStatDisplay.tsx`, `PokemonMoveButton.tsx`, `SaveFileDropzone.tsx`, `PokemonStatusPlaceholder.tsx`); `index.ts` for re-exports.

### Parser structure
- `src/lib/parser/`
	- `core/`: main parser and abstractions (`PokemonSaveParser.ts`, `GameConfigBase.ts`, `GameConfigRegistry.ts`, `PokemonBase.ts`, `types.ts`, `utils.ts`).
	- `games/`: game-specific configs and wiring (e.g., `vanilla/`, others) with `games/index.ts` aggregating exports.
	- `data/`: auxiliary parser data (e.g., `pokemon_charmap.json`).
	- `cli.ts`: CLI entry for parsing from the command line (`npm run parse`).
	- `__tests__/`: parser unit/integration tests and `__tests__/test_data/` sample saves.
	- `README.md`: parser documentation and architecture overview.

## Principles

- Environment-first:
	- Identify tooling from local config (`package.json`, `tsconfig*`, `vite.config*`, Docker, etc.).
	- Prefer local actions; add dependencies only when necessary and justified.
- Surgical edits:
	- Smallest diff that solves the problem; don’t reformat unrelated code; preserve style/public APIs.
	- DRY and anti-bloat: remove duplication and unnecessary logic; prune truly dead code safely.
- Verification:
	- Build/lint/typecheck; run unit/e2e tests when present; otherwise do a quick smoke test.
- Working style:
	- Fix errors without asking; avoid confirmations; ignore warnings unless requested.
	- Prefer modern, maintainable patterns.
	- After the main task, briefly note any clear simplifications or modernizations.
	- Don’t create VS Code tasks unprompted.

## Quality gates

- Build/Lint/Typecheck: PASS
- Tests (unit/e2e): PASS when present
- Smoke test of the user-visible path: PASS

## Communication

- Use Markdown sparingly—format only relevant snippets (code, tables, commands) with proper fences.
- Always wrap file, directory, function, and class names in backticks.
- Keep messages concise and skimmable; avoid pre/postamble and filler. Prefer direct answers.
- Avoid emojis unless the user explicitly asks.
- Refer to changes as "edits"; state assumptions briefly and proceed unless blocked.

## Execution workflow

- Agent mindset: keep going until the user's query is resolved; stop only when solved or truly blocked.
- Discovery first for new goals: scan relevant files/config to ground yourself (read-only).
- Batch read-only context operations and prefer parallelizing independent reads/searches.
- After ~3–5 tool calls or when editing >3 files, post a brief checkpoint update.

## Status updates

- Keep to 1–3 sentences: what just happened, what's next, and any blockers/risks.
- If you say you'll do something, execute it in the same turn.

## Tool usage

- Prefer local info and tools; don't mention tool names in chat.
- Read sufficiently large chunks instead of many tiny reads; use project aliases (e.g., `@/*`).
- Sequence dependent actions; parallelize independent, read-only operations.
- When running non-trivial terminal commands, briefly explain what/why before executing.

## Code changes

- Make minimal, surgical edits; avoid reformatting unrelated code and preserve public APIs.
- Ensure builds/tests pass and fix introduced errors before finishing.
- Add necessary imports/types/config so the code runs; avoid dumping large code into chat—apply edits in files.
- Do not commit or push changes unless explicitly asked by the user.