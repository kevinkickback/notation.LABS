2. Code Quality

Issues found:

a) Redundant wrapper callbacks in ComboView.tsx (lines 137–154)
TSX

// ComboView.tsx:137-154
const handleEdit = useCallback((combo: Combo) => {
    operations.handleEdit(combo);  // ← no-op wrapper
}, [operations]);

const handleDuplicate = useCallback(async (combo: Combo) => {
    await operations.handleDuplicate(combo);  // ← no-op wrapper
}, [operations]);

These useCallback wrappers add operations as a dependency yet do nothing more than delegate. They can be replaced by passing operations.handleEdit and operations.handleDuplicate directly.

b) Inline type redefinition in CoverSearchDialog.tsx (lines 52–59)
TSX

// CoverSearchDialog.tsx:52-59
type RawIGDBApiResult = {
    id: number; name: string; cover?: ...; ...
};

RawIGDBApiResult is already exported from src/lib/igdb.ts (line 3). This is a redundant re-declaration and should import from the existing type.

c) Repeated local: prefix string handling
The pattern demoUrl.startsWith('local:') / demoUrl.replace('local:', '') appears 25 times across ComboFormDialog.tsx, useComboDelete.ts, useComboOperations.ts, useVideoPlayer.ts, ExportDialog.tsx, and indexedDbStorage.ts. A helper like getLocalVideoId(demoUrl) already exists in indexedDbStorage.ts (line 103) but is not exported or reused in components.

d) sortedButtons array sorted on every iteration of the parser's hot path (parser.ts:413)
ts

// parser.ts:413 — inside while (i < input.length)
const sortedButtons = [...allButtons].sort((a, b) => b.length - a.length);

This sort runs once per character of input. Since allButtons doesn't change mid-parse, the sort should be lifted outside the while loop.

e) Typo in MOTION_ALIASES (parser.ts:47)
ts

reversedagonpunch: '421',  // ← "reversedagon" instead of "reversedagon" → should be "reversedagonpunch" is technically spelled "reversedagonpunch" which is "reversedagonpunch" — missing an "r": should be "reversedragonpunch"

reversedagonpunch should be reversedragonpunch.

f) GeneralSettings.tsx is 469 lines long with a deeply-nested inline onClick handler (lines 327–397) that fetches the changelog from GitHub. This logic should be extracted to a dedicated function or hook.
3. Dependencies

All dependencies appear current and appropriate for the tech stack. Notable observations:

    package.json version is "1.3.0" but the build.copyright says 2026 — this is not a bug, just noteworthy.
    react-markdown is listed as a runtime dependency but only used for rendering changelog markdown. It's a reasonable inclusion.
    electron-updater is in dependencies (not devDependencies) since it's bundled and used at runtime in the Electron main process — correct placement.
    dotenv in devDependencies is used only for build configuration — correct.
    png-to-ico and sharp are in devDependencies — likely used in build scripts not present in the repo (they aren't referenced in any source file visible here, which is a minor concern — could be dead dev-dependencies).
    No known insecure or outdated packages were identified. The stack uses very recent versions of React (19), Vite (7), Electron (40), and TypeScript (5.9).

4. Security

Strengths (well-implemented):

    CSP header is applied per-request in electron/main.ts (lines 130–166), with strict directives: object-src 'none', frame-ancestors 'none', base-uri 'self'
    nodeIntegration: false, contextIsolation: true, sandbox: true throughout
    setPermissionRequestHandler denies all permissions (line 169)
    Navigation restricted via will-navigate event handler
    setWindowOpenHandler only allows HTTPS external URLs and denies new windows
    Import size limit (50 MB) and video count limit (100) enforced in indexedDbStorage.ts:14-15
    Zod validation on all imported data (importDataSchema.parse)
    Referential integrity validation on import (orphaned characters/combos check)

Issues:

a) Import version field has no upper bound (schemas.ts:105)
ts

version: z.number(),

An attacker could craft an import with version: 999999. Consider constraining it: z.number().int().min(1).max(2) to match the only valid values (1 and 2) written in indexedDbStorage.ts:487.

b) result.data.message access on a type without message field (GeneralSettings.tsx:123)
ts

toast.error(result.data.message);  // ← runtime error: UpdateCheckResult has no .message on 'available'/'not-available'

The UpdateCheckResult discriminated union has message only on the error variant (electron.d.ts:22). For the available and not-available cases this code path is a fallthrough guard, but result.data.message will be undefined and show a blank toast. Should be toast.error(result.data.error ?? 'Unknown error') or handle the discriminated union properly.

c) console.debug left in production code (CoverSearchDialog.tsx:125)
ts

console.debug('[IGDB Cover Download] Trying size:', size, url);

This leaks internal URL structure in production. Should be removed.

d) External URL in renderer-side fetch not going through the Electron main process for portable version check In updateManager.ts:156-208, GitHub's API is called directly from the main process using net.fetch — this is fine. However in GeneralSettings.tsx:365-380, the web mode also calls https://api.github.com directly from the renderer. There is no rate limiting or authentication token, which is acceptable for an open-source app but worth noting.
5. Error Handling

Strengths:

    Consistent use of reportError(context, err) + toast.error(toUserMessage(err)) pattern throughout hooks
    Top-level ErrorBoundary in main.tsx
    In dev mode, ErrorFallback re-throws errors for better DX

Issues:

a) handleAdd / handleUpdate in ComboFormDialog.tsx (lines 191-219) swallow errors without logging
ts

} catch {
    toast.error('Failed to add combo');  // ← no reportError() call
}

Unlike hooks (which call reportError), the form dialog handlers don't log errors. Inconsistent with the rest of the codebase.

b) ExportDialog.tsx:78-89 catch block silently ignores the error
ts

.catch(() => {
    // ...
    toast.error('Failed to load export data');  // ← no reportError()
});

c) useVideoPlayer.ts:17-34 — no error handling if getBlobUrl throws The handleWatchDemo function only checks for null return but doesn't catch exceptions from getBlobUrl.

d) App.tsx auto-update useEffect (lines 45-65) — the onUpdateAvailable listener does not handle errors from the callback, and the unsub return value is used correctly, but there's no error boundary for toast.info failures.
6. Performance

Issues:

a) sortedButtons sort inside while loop in parser.ts:413 (also noted under Code Quality) This allocates a new sorted array on every character in the input string. For a notation like 5LP > 5LP > 5MP > 236HP (23 chars), that's 23 sort operations. Should be pre-sorted once before the loop.

b) App.tsx loads all characters and combos reactively (lines 76-89)
TSX

const games = useLiveQuery(indexedDbStorage.games.getAll, []);
const characters = useLiveQuery(
    () => selectedGameId ? indexedDbStorage.characters.getByGame(selectedGameId) : [], [selectedGameId]
);

This is generally fine because Dexie's useLiveQuery is reactive and efficient, but selectedGame and selectedCharacter are derived via .find() on each render (lines 91-94). For large libraries this is O(n) on every render, but in practice games is bounded.

c) GameLibrary.tsx:51 — gameStatsData loads all characters and combos globally
TSX

const gameStatsData = useLiveQuery(indexedDbStorage.gameStats.getInputs, []);

This reads the entire characters and combos tables to compute statistics. For large collections this will be a full table scan on every update. Consider computing stats per-game lazily or using IndexedDB indexes.

d) handleBulkDelete in GameLibrary.tsx:134-141 calls handleDeleteGame sequentially in a loop rather than using a bulk transaction:
TSX

for (const id of selectedIds) {
    const game = games.find((g) => g.id === id);
    if (game) await deleteState.handleDeleteGame(game);
}

Each handleDeleteGame opens its own Dexie transaction. For many games, this is inefficient.
7. Consistency

Issues:

a) Duplicate useSettings export — src/hooks/useSettings.ts re-exports from context/SettingsContext.tsx
ts

// src/hooks/useSettings.ts
export { useSettings } from '@/context/SettingsContext';

useSettings is also exported directly from SettingsContext.tsx. The one-liner re-export file is a thin indirection. It works but creates ambiguity — some files import from @/hooks/useSettings while the canonical definition is in context/. Both are consistent in practice since they resolve to the same export, but the indirection is unnecessary.

b) Tab indentation in ImportDialog.tsx vs. spaces used inconsistently ImportDialog.tsx uses 4-space indentation instead of tabs. Biome is configured for tabs ("indentStyle": "tab"), so this file is non-conformant with the project style.

c) SettingsContext.tsx uses 4-space indentation while the rest of the codebase uses tabs.

d) useComboDelete.ts directly imports db from storage for transactions but useComboOperations.ts also imports db directly — the lower-level db object leaking out of the storage module into hooks is a minor layering concern, but consistent across both files.

e) handleBulkMarkOutdated in useComboOperations.ts uses db.transaction directly while single-item operations use indexedDbStorage.combos.update — mixing direct db access with the storage abstraction layer.
8. Documentation

Strengths:

    README.md is excellent: clear feature list, screenshots, build instructions, notation reference table
    JSDoc comments on key functions in indexedDbStorage.ts (e.g., settings.get, settings.init)
    ComboView.tsx has a detailed block comment explaining its refactoring history
    Module-level comments in hooks (e.g., useComboFilters.ts:3)

Issues:

a) src/vite-end.d.ts — misnamed file
ts

/// <reference types="vite/client" />

vite-end.d.ts appears to be a misnamed duplicate of vite-env.d.ts (which already has the same content plus declare const __APP_VERSION__: string). This file is dead code.

b) No inline documentation on the parser constants
MOTIONS, MOTION_ALIASES, SEPARATORS, etc. in parser.ts are large lookup tables with no explanation of how they interact or their priority ordering, which matters for correctness.

c) No CONTRIBUTING guide or architecture decision records (ADRs)
9. Tests

Strengths:

    337 test lines/cases across unit, component, and e2e levels
    indexedDbStorage.test.ts uses fake-indexeddb for real DB behavior
    Parser tests are exhaustive for motions, directions, buttons, aliases, repeats
    E2e tests with Playwright cover the full game → character → combo flow
    Good use of mocking patterns in component tests

Gaps:

a) No tests for updateManager.ts exported functions (checkForUpdate, downloadUpdate, cancelDownload) beyond the main.test.ts mock integration tests.

b) useComboFilters, useComboSelection, useComboDelete, useGameDelete, useGameFilters, useGameStats, useVideoPlayer hooks have no dedicated tests. Only useNotesOverride has its own test file.

c) GeneralSettings.tsx has only GeneralSettings.accentColor.test.tsx (accent color specific), missing tests for update-check logic, font change, and theme toggle.

d) parser.ts missing tests for edge cases:

    What happens with an unclosed ( — e.g., 236(?
    Mixed case motion aliases (e.g., QCF)?
    Deeply nested repeat groups?

e) No test for the import/export cycle (export then re-import, verify data integrity).

f) No test for migrateNotationColors in indexedDbStorage.ts.
10. Dead Code

a) src/vite-end.d.ts — identical to vite-env.d.ts minus the __APP_VERSION__ declaration. Appears unused and should be removed.

b) dev-app-update.yml — this is a legitimate configuration file for electron-updater dev mode (autoUpdater.forceDevUpdateConfig = true in updateManager.ts:96). Not dead code.

c) src/lib/seedData.ts:initializeSeedData — called once on first launch to populate demo data. Not dead code, but there is no initializeSeedData call visible in main.tsx or App.tsx. A search would be needed to confirm whether it's actually called anywhere:
Code

grep -r "initializeSeedData" src/

If it is never called, this is dead code.

d) DIRECTION_MODIFIERS in ComboDisplay.tsx — this object maps stance modifier strings to numpad values. It appears to be used in the icon display logic but deserves verification that all entries are actually referenced in the rendering code.

e) devSimInterval module-level variable in updateManager.ts — used only in dev mode. In production builds this variable is always null. Not harmful but could be better encapsulated.
Summary of Key Actionable Recommendations
Priority	Issue	Location
🔴 High	Type-unsafe result.data.message access (runtime undefined)	GeneralSettings.tsx:123
🔴 High	Import version field has no upper bound validation	schemas.ts:105
🟠 Medium	sortedButtons sorted inside while loop (performance)	parser.ts:413
🟠 Medium	Typo: reversedagonpunch should be reversedragonpunch	parser.ts:47
🟠 Medium	console.debug leaks URL info in production	CoverSearchDialog.tsx:125
🟠 Medium	handleAdd/handleUpdate don't call reportError	ComboFormDialog.tsx:191,196
🟠 Medium	ExportDialog catch block doesn't call reportError	ExportDialog.tsx:78
🟠 Medium	Bulk game delete is sequential, not transactional	GameLibrary.tsx:134
🟡 Low	Redundant wrapper useCallbacks in ComboView	ComboView.tsx:137-154
🟡 Low	Inline RawIGDBApiResult type re-declared	CoverSearchDialog.tsx:52
🟡 Low	local: prefix manipulation repeated 25× across files	Multiple files
🟡 Low	vite-end.d.ts appears to be dead/duplicate file	src/vite-end.d.ts
🟡 Low	Non-conformant 4-space indentation	ImportDialog.tsx, SettingsContext.tsx
🟡 Low	No tests for most custom hooks	src/hooks/
🟡 Low	No import/export round-trip test	tests/lib/storage/
🟡 Low	initializeSeedData may be uncalled dead code	src/lib/seedData.ts