# Copilot Instructions for notation.LABS

## Project Overview
notation.LABS is a fighting game combo tracker that ships as both a **web app** and an **Electron desktop app** from a single shared codebase, using separate build targets. It manages combos, characters, and games, optimized for speed, clarity, and ease of use.

## Tech Stack
- **React** — frontend UI
- **TypeScript** — strict mode enabled; no `any` unless explicitly justified
- **Electron** — desktop shell (main + renderer process separation)
- **Vite** — build tool (`vite-plugin-electron`, `vite-plugin-electron-renderer`)
- **Tailwind CSS** — utility-first styling
- **Radix UI** — unstyled component primitives
- **Dexie** — IndexedDB ORM for all persistent storage
- **Biome** — linting and formatting (not ESLint, not Prettier)
- **Vitest** + **@testing-library/react** + **@testing-library/user-event** + **jsdom** — unit/component testing
- **Playwright** — E2E testing
- **electron-builder** — desktop app packaging

## Key Package Scripts
| Script | Purpose |
|---|---|
| `dev:web` | Start web dev server |
| `dev:app` | Start Electron app in dev mode |
| `build:web` | Production build (web) |
| `build:app` | Production build (Electron desktop) |
| `test` | Run Vitest unit tests |
| `test:coverage` | Run Vitest tests and enforce coverage thresholds |
| `test:e2e` | Run Playwright E2E tests |
| `lint` | Run Biome linter/formatter |
| `version:check` | Verify package and release-tag metadata, including the matching tagged changelog |

## Architecture Notes
- **Storage:** All persistent data uses **IndexedDB via Dexie**. Never use `localStorage` or `sessionStorage` — these are inconsistent with the IndexedDB-backed architecture and will not work correctly in Electron.
- **Electron IPC:** Communication between the main and renderer processes must go through defined IPC channels (`ipcMain` / `ipcRenderer`). Do not access Node.js APIs directly from renderer code.
- **Settings:** App settings are fetched from IndexedDB. Avoid patterns that cause redundant or cascading DB reads (e.g., calling `useSettings` inside loops or deeply nested components).
- **Dialogs:** Shared dialog primitives keep modal content within the viewport. Long or dynamically growing forms must use `DialogBody` for scrolling and keep actions in a persistent `DialogFooter`.
- **Form hierarchy:** Group long, multi-concept forms with compact cards. Keep short and single-purpose dialogs visually simple.
- **Required fields:** Use the shared `RequiredBadge` instead of asterisks, and add the native `required` attribute to each required control.
- **Cover images:** Use the shared `CoverImage` renderer and `CoverImageControls` editor so previews and saved cards use the same fill/free crop, zoom, and focal-point behavior.
- **Notation profiles:** Route profile-specific parsing and labels through `src/lib/notationProfiles.ts`. Keep legacy `inputType` values read-compatible for migrations/imports, but write `notationProfile` for current games.
- **Component size:** Prefer focused, single-responsibility components. If a component exceeds ~600 lines, consider breaking it up.
- **Types:** `src/lib/types.ts` is the single source of truth for all shared data models.

## Non-Negotiables

### After every code change:
**Always run `lint` before considering a task complete.** Fix all Biome errors and warnings before finishing.

### TypeScript & Code Style
- Keep `src/lib/types.ts` up to date with any data model changes — update it first, then propagate.
- No `any` types without an explicit inline comment explaining why.
- Prefer clear, descriptive names over comments.
- Use inline comments only when code is genuinely non-obvious.
- Use JSDoc only for public functions, exported types, and classes that are not self-explanatory or have complexity.
- Maintain idiomatic TypeScript and React style throughout.

### Testing
- All new features require relevant tests — unit, component, or E2E. CI and release builds run unit coverage and browser tests.
- Coverage thresholds represent the verified project baseline. Do not lower them; add tests and ratchet them upward as coverage improves.
- **Never use Jest** — not its APIs, matchers, globals, or CLI commands. This project does not use Jest.
- **Always explicitly import** test utilities:
  - Unit/component: `import { test, expect, describe, vi } from 'vitest'`
  - E2E: `import { test, expect } from '@playwright/test'`
- All test files must be compatible with Vitest (unit) or Playwright (E2E) runners only.
- Do not rely on globally injected test functions — always import explicitly.
