# CI/CD Workflow

## Branches and repository settings

`main` is the only long-lived branch. Start each change from current `main` on a short-lived branch,
open a pull request back to `main`, and delete the branch after its squash merge.

Protect `main` with the repository's **Main Protection** ruleset:

- Disable direct pushes and require the branch to be up to date before merging.
- Allow squash merging only; disable merge commits and rebase merging.
- Enable GitHub native auto-merge and automatic head-branch deletion.
- Require these two CI checks:
  - **Lint, type-check, test, and build**
  - **Browser tests**
- Enable automatic Copilot review, including review of new pushes.
- Do not require review-conversation resolution. Copilot is advisory input before enabling
  auto-merge and before publishing a release.

Passing CI does not opt a pull request into merging. Once a change is intentionally ready, select
**Enable auto-merge** with the squash method. GitHub then merges the exact eligible revision after
all branch-protection requirements pass. There is no custom merge workflow or repository-dispatch
handoff.

For every pull request, wait for the automated Copilot review of the current head revision before
enabling auto-merge. Inspect each finding, fix valid issues, and run the affected checks again. After
pushing corrections, wait for the review of the new revision as well. Passing CI alone does not
complete this review step.

Pull requests that change `.github/workflows/**`, `.github/scripts/**`, or
`scripts/check-release.mjs` are the exception: do not enable auto-merge until the complete workflow
diff and advisory review have been inspected. Once that review is complete, the pull request may use
the same native squash auto-merge path. CI status names alone are not a trust boundary because a pull
request can change the workflow that produces them. Add required CODEOWNERS approval for these paths
when the project has a second maintainer; a solo maintainer cannot provide an independent approval.

---

## Day-to-day development

Create a branch from current `main`:

```bash
git switch main
git pull --ff-only
git switch -c feat/short-description
```

Commit and push the branch, then open a pull request:

```bash
git push -u origin feat/short-description
gh pr create --base main --fill
```

Wait for Copilot's review, address its findings, and verify CI. Then enable auto-merge:

```bash
gh pr merge --auto --squash
```

This command opts that pull request into GitHub native auto-merge. It does not bypass CI,
branch protection, or an out-of-date base.

`ci.yml` runs on every non-draft pull request targeting `main`. It validates release metadata,
audits production dependencies and the shipped Electron runtime, runs Biome and TypeScript,
executes Vitest with coverage, builds and validates the desktop and renderer bundles, and runs the
browser suite separately. Repository-run Node commands use Node 24, matching `.nvmrc` and the
package engine requirement.
`npm run audit:electron` checks the full npm audit for Electron advisories, since the binary ships
despite its development dependency classification. The separate production audit covers bundled
app libraries. Release build jobs repeat both audits before packaging. Audit request failures stop
the checks. See [dependency security](dependency-security.md)
for the remaining build-tool advisory and its exposure assessment.
Linux CI and release jobs use the explicit `ubuntu-26.04` runner instead of `ubuntu-latest`, so a
future GitHub runner migration cannot change the build environment without a reviewed repository
change.

The desktop main process owns update status and release metadata. Its `update-status` event and
`update:status` / `update:check` replies carry complete snapshots with a monotonically increasing
revision. The renderer subscribes before reading its initial snapshot and ignores older replies.
Release-note requests only enrich their matching update; closing an update dialog changes the
presentation, not the download state. Portable check failures are reported as errors, and installer
checks cannot replace an active download or a ready installer.

Backup transfers use one application command, destination contract, and bundled worker for JSON and
ZIP. Storage captures a consistent record snapshot and pins immutable media; codecs stream bounded
chunks and await destination writes. Imports stage validated records and payloads before atomically
publishing references. The transfer hook owns progress, cancellation, and the busy guard in both
directions. Cancellation rolls back before commit; final publication and destination replacement are
not cancellable. Desktop saving uses the narrow preload bridge and an atomic temporary-file commit.
Browser saving uses a native picker when available, otherwise a native streaming Blob download.
See [backup formats and validation](backups.md) for compatibility, recovery, allocation budgets, and
the separate packaged large-file validation procedure.
Desktop image uploads and backup images share the existing record-allocation budget; the smaller
2 MiB upload limit applies only to web uploads. ZIP export preserves valid legacy raster bytes and
normalizes mislabeled raster types in the backup without changing source records. Validation errors
cross the transfer boundary as readable messages rather than serialized schema issue arrays.

Application initialization sets up preferences, then runs versioned notation maintenance. Preference
reads and initialization do not rewrite combos. Maintenance commits derived combo tokens and the
local parser version in one transaction; failures leave both unchanged for retry. Imports derive
their own tokens and atomically refresh retained combos affected by changed game controls or a
character's parent game. Up-to-date libraries do not reparse unrelated combos. A backup's parser
version cannot replace the local maintenance marker. Older libraries receive one complete parser
update in the same import transaction. Existing database migration history is preserved.

Persisted editors share a synchronous submission guard. One write stays pending per mounted editor
until it settles, even if the editor closes or changes entity. Successful completion may only close
or reset the original session; failures are still reported after closing. Native form fields are
disabled while saving, while closing remains available. Editors stay mounted across empty and
populated collection states so a live read cannot interrupt a pending save. Combo editing keeps one typed draft and
retains tags as an array rather than serializing them through comma-separated text. Media requests
continue to use their separate cancellable lifecycle.

Export selection stores only selected leaves: combos and games or characters without children.
Parent checkbox states include every descendant, including empty characters, and partial parent
selection selects the whole branch when checked. The existing backup closure derives required
parents for the final export; components do not synchronize parent selections manually. A closed
export dialog's pending reads cannot replace a reopened session's data.

Single and bulk game or character deletion use the same storage cascade. Records, descendant combos,
unreferenced local videos, and notebook page choices commit in one transaction. Videos referenced by
retained combos stay available. Preference normalization can read both parent tables inside that
transaction, including older default-open settings; any write failure leaves the entire cascade
unchanged for retry.

Card grids use flexible columns to fill the content width, preserving empty slots in incomplete
rows. Their size sliders expose one stop per distinct layout at the observed container width.
Window resizing and notebook docking recalculate choices without rewriting the saved target size.
Character columns retain the v1.8.0 width multiplier and current portrait aspect ratios.

Notification emitters share one typed helper for temporary feedback and best-effort device history.
Dexie retains the newest 100 entries for 30 days, outside library backups. Warnings, errors, and
updates start unread; routine confirmations do not light the footer bell. Validation prompts and
continuous progress stay out of history. Operation IDs update an existing entry without replaying
saved messages; update actions resolve current updater state. Storage or clipboard failures use
diagnostics and temporary feedback without recursively creating history or failing library writes.
The footer panel uses the existing Radix focus and positioning primitives, with scrollable content.
Update snapshots carry a stable state-event ID. A device-local cursor records consumed update events
atomically with history and survives clearing/removal, so retained snapshots and delayed notes cannot
recreate dismissed notices. New checks receive new identities, including across app restarts.
Electron permits sanitized clipboard writes only from the live app's main frame at its configured
renderer URL. Clipboard reads, embedded pages, and unrelated permissions remain denied.

The renderer entry imports `src/main.css` once; HTML must not also load it as a stylesheet.
Tailwind source discovery is limited to `src/`, with the HTML entry explicitly included by `@source`,
so dependency watches do not walk the entire workspace during cold development startup.
Styling imports Tailwind once through `src/main.css`. `src/styles/theme.css` owns the app's light and
dark values and Tailwind aliases; `src/index.css` holds global element styles. The settings provider
applies the `.dark` class, font, and custom accent, and notifications read the same theme preference.
The Tailwind configuration retains the centered container spacing used by the workspace.
Accent appearance uses opaque sRGB colors and selects black or white foreground text by relative
luminance using the [WCAG contrast calculation](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Native browser color parsing handles non-hex choices without an additional dependency.
Primary and accent hover surfaces stay opaque so the calculated contrast is retained.

## Releasing a version

### 1. Prepare the release on a feature branch

Update `package.json` and `package-lock.json` together:

```bash
npm version 1.0.0 --no-git-tag-version
```

Add nonempty user-facing notes to `changelogs/v1.0.0.md`. The file becomes the draft release body.
Validate it locally with `npm run version:check`, then open a normal pull request to `main` and
enable squash auto-merge.

### 2. Manually create the draft

After the release pull request reaches `main`, fetch its exact revision and send the manual release
request:

```bash
git fetch origin main
gh api --method POST repos/kevinkickback/notation.LABS/dispatches \
  -f event_type=release-requested \
  -f "client_payload[source_sha]=$(git rev-parse origin/main)"
```

Repository dispatch always loads the workflow from protected `main`; the supplied revision must
still be the current `main` head when validation and draft creation run.

The workflow:

1. Requires a full source revision that is the current `main` head.
2. Validates stable version metadata, the matching changelog, and a version newer than every
   published stable release in a read-only job.
3. Inspects draft and tag state in a separate job that executes no repository code.
4. Refuses to modify any existing release or move an existing tag.
5. Builds Windows, macOS, and Linux packages in parallel without repository write credentials.
6. Validates the exact ten-file package bundle and updater manifests.
7. Re-checks that no release appeared and repeatedly verifies `main` and the tag immediately before
   creating the draft.
8. Records build provenance, creates one clean draft, and verifies its notes, tag, and assets.

The workflow never publishes the release. Review the release notes, all ten assets, the Windows
portable build, and any advisory review findings before publishing the draft manually.

### Recovery and repeat runs

The manual workflow is state-aware and never deletes or moves pre-existing release state:

| Existing state | Result |
| --- | --- |
| No tag and no release | Creates both after successful builds |
| Correct tag and no release | Reuses the tag and creates the draft |
| Any unpublished draft | Stops; inspect and delete the draft deliberately before rerunning |
| Unpublished tag points elsewhere | Stops; inspect and delete the tag deliberately before rerunning |
| Any published release for the version | Always stops; use a new version |

If a tag and release were both deleted, run the workflow normally. If a failed attempt left a draft
or an unpublished tag at the wrong commit, inspect that state on GitHub, remove only the confirmed
unpublished object, and rerun. The workflow uses atomic tag creation and immediate state
revalidation to stop safely when a concurrent tag, draft, or `main` change is detected.

### Release artifacts

| File | Platform |
| --- | --- |
| `Notation-Labs-<version>-Win.exe` + `.exe.blockmap` | Windows installer |
| `Notation-Labs-<version>-Win-Portable.exe` | Windows portable |
| `Notation-Labs-<version>-Mac.dmg` + `.dmg.blockmap` | macOS |
| `Notation-Labs-<version>-Linux.AppImage` | Linux portable |
| `Notation-Labs-<version>-Linux.deb` | Debian/Ubuntu |
| `latest.yml`, `latest-mac.yml`, `latest-linux.yml` | Auto-update manifests |

Windows and macOS artifacts are currently unsigned. Windows may display a SmartScreen warning,
and macOS users may need to approve the application under Privacy & Security.

---

## Operational rules

- Do not create version tags or releases manually; run the release workflow.
- Never replace or convert a published release. Corrections to a published version require a new
  version.
- Do not publish a draft while its workflow is active.
- Publish only after reviewing release notes, all ten assets, the Windows portable binary, and any
  advisory findings.
- Stable releases use `X.Y.Z` package versions and `vX.Y.Z` tags. Prerelease/build suffixes are
  rejected.

`npm run build:app` performs the production Electron build and creates the platform packages.

`npm run build:desktop` builds both app surfaces and stages the compiled files in
`.tmp/desktop-app` with a generated manifest that copies the root version and app identity.
The desktop main process and preload bundle their libraries; the staging check rejects unbundled
or dynamic runtime module imports. Electron Builder packages this staged app, preserving icons,
updater configuration, platform helpers, and the configured security fuses. The root dependencies
remain the source for production dependency auditing, including libraries bundled into the renderer.
There are no native app modules to rebuild.
The build retains published dependency license files for each bundled surface, falling back to
the package's license and author metadata when no notice file is published. It also retains the
app's `LICENSE`, so removing installed dependencies does not remove their published notices.
The packager's `beforeBuild` hook validates the staged runtime and explicitly skips dependency
collection; an empty manifest alone would make Electron Builder fall back to the root dependency tree.

After building, run `npm run package:check -- <packaged-executable>` against the unpacked executable
(inside `Contents/MacOS` on macOS). This checks the archive, app identity, updater resources, security
fuses, preload, and persisted edits in the real production binary, using a fresh profile under `.tmp`.
It also verifies saved notification history survives a reload without replaying the completed action.
The check connects to Chromium for testing without enabling the Node inspector or changing the binary.

Publish an approved draft with:

```bash
gh release edit v1.0.0 --draft=false --repo kevinkickback/notation.LABS
```

Inspect release runs with:

```bash
gh run list --repo kevinkickback/notation.LABS --workflow release.yml --limit 5
gh run view <RUN_ID> --repo kevinkickback/notation.LABS
```
