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
gh pr merge --auto --squash
```

The final command opts that pull request into GitHub native auto-merge. It does not bypass CI,
branch protection, or an out-of-date base.

`ci.yml` runs on every non-draft pull request targeting `main`. It validates release metadata,
audits production dependencies, runs Biome and TypeScript, executes Vitest with coverage, builds the
web app, and runs the browser suite separately. Repository-run Node commands use Node 24, matching
`.nvmrc` and the package engine requirement.
Linux CI and release jobs use the explicit `ubuntu-26.04` runner instead of `ubuntu-latest`, so a
future GitHub runner migration cannot change the build environment without a reviewed repository
change.

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

After the release pull request reaches `main`, open **Actions → Release → Run workflow**, select
`main`, and run it.

The workflow:

1. Requires the dispatched revision to be the current `main` head.
2. Validates stable version metadata and the matching changelog section.
3. Refuses to modify any existing release or move an existing tag.
4. Builds Windows, macOS, and Linux packages in parallel without repository write credentials.
5. Validates the exact ten-file package bundle and updater manifests.
6. Re-checks that no release appeared and repeatedly verifies `main` and the tag immediately before
   creating the draft.
7. Records build provenance, creates one clean draft, and verifies its tag and assets.

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

Publish an approved draft with:

```bash
gh release edit v1.0.0 --draft=false --repo kevinkickback/notation.LABS
```

Inspect release runs with:

```bash
gh run list --repo kevinkickback/notation.LABS --workflow release.yml --limit 5
gh run view <RUN_ID> --repo kevinkickback/notation.LABS
```
