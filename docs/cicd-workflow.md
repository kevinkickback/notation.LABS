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
