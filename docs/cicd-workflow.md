# CI/CD and release workflow

`dev` is the integration branch and `main` is the stable production branch. Short-lived branches
merge into `dev`; `main` receives only squash merges from a same-repository `dev` to `main` pull
request. Do not push commits or tags directly to `main`.

## Repository setup

Configure GitHub to:

- protect `main` from direct and force pushes and branch deletion;
- allow squash merging and disable merge commits and rebase merging;
- require resolved review conversations plus **Lint, type-check, test, and build** and
  **Browser tests**;
- retain `dev` after a production merge;
- give Actions read/write workflow permission; and
- protect published `vX.Y.Z` tags from updates and deletion.

The workflow files do not configure repository rulesets. Required human reviews may remain enabled;
GitHub's merge API honors repository merge requirements.

## CI and merging

CI runs for non-draft pull requests targeting `dev` or `main`. It verifies version metadata, audits
production dependencies, runs Biome and TypeScript, executes Vitest with coverage, builds the web
app, and runs Playwright in a separate job. Feature PRs into `dev` are checked but never
auto-merged.

A ready, same-repository `dev` to `main` PR is squash-merged only after both jobs pass. The merge
job re-reads the PR and `main` branch, rejects a changed head or base revision, and merges the exact
SHA that passed CI. It also waits briefly for an optional Copilot review of that revision. Copilot
is advisory: if no review starts within one minute, or an active review does not finish within ten
minutes, the workflow continues. Unresolved conversations can still block merging through the
repository ruleset.

The resulting squash commit is passed directly to the reusable release workflow. Ordinary PRs with
an unchanged package version still merge, but the release workflow detects the unchanged version
and exits without creating a tag or release.

## Prepare a release on dev

Replace `X.Y.Z` with a stable version such as `1.9.0`. Prereleases are intentionally unsupported
because the desktop updater uses the stable `latest*.yml` channels.

```bash
git switch dev
git pull --ff-only
npm ci
npm version X.Y.Z --no-git-tag-version
```

Create `changelogs/vX.Y.Z.md` with nonempty user-facing notes. Its complete contents become the
draft release body. Keep `package.json` and both root version fields in `package-lock.json`
synchronized.

Run the local release gate:

```bash
npm run version:check
npm audit --omit=dev --audit-level=high
npm run lint
npx tsc -b
npm run test:coverage
npm run build:web
npx playwright install chromium
npm run test:e2e
git diff --check
```

Linux may require `npx playwright install --with-deps chromium`. Commit and push the complete
release source, metadata, changelog, and required `build/` packaging resources. Do not create the
release tag yourself.

## Open the production PR

```bash
gh pr create --base main --head dev --title "Release vX.Y.Z" --body-file changelogs/vX.Y.Z.md
gh pr checks PR_NUMBER --watch
```

No merge command is needed. Once repository requirements and CI pass, the workflow squash-merges
the exact checked revision. If the PR changes during or after checks, the merge is rejected until
the latest revision passes.

## Automated release

For a version-changing squash commit, `release.yml`:

1. Confirms the source is a single-parent squash commit associated with a merged,
   same-repository `dev` to `main` PR.
2. Requires an increased stable `X.Y.Z` version, synchronized package metadata, and a matching
   nonempty `changelogs/vX.Y.Z.md`.
3. Creates the lightweight `vX.Y.Z` tag on the reviewed `main` squash commit. Existing tags are
   reused only when they already point to that exact commit.
4. Creates or refreshes a draft GitHub release; published releases are never replaced.
5. Builds Windows, macOS, and Linux packages on native runners, verifies their expected outputs,
   and records GitHub artifact attestations.
6. Stages platform packages as one-day Actions artifacts, uploads them in one controlled job, and
   verifies the draft status, exact notes, required filenames, and nonempty assets.
7. If a downstream job fails after draft creation, deletes only the unpublished draft and its
   workflow-created tag when that tag still points to the failed release SHA. Published releases
   and unrelated tags are preserved.

Runs are serialized with the `release-main` concurrency group. The workflow never publishes a
release; inspect and test the verified draft before publishing it manually.

| Platform | Required draft assets |
|---|---|
| Windows | `Notation-Labs-X.Y.Z-Win.exe`, `Notation-Labs-X.Y.Z-Win-Portable.exe`, `Notation-Labs-X.Y.Z-Win.exe.blockmap`, `latest.yml` |
| macOS | `Notation-Labs-X.Y.Z-Mac.dmg`, `Notation-Labs-X.Y.Z-Mac.dmg.blockmap`, `latest-mac.yml` |
| Linux | `Notation-Labs-X.Y.Z-Linux.AppImage`, `Notation-Labs-X.Y.Z-Linux.deb`, `latest-linux.yml` |

The staging globs retain any additional generated blockmaps. Existing packaging and signing
configuration remains unchanged.

## Review and publish

```bash
gh run list --workflow release.yml --limit 5
gh run watch RUN_ID --exit-status
gh release view vX.Y.Z --json tagName,name,isDraft,isPrerelease,body,assets,url
gh release edit vX.Y.Z --draft=false
```

Attestations can be verified with GitHub CLI, for example:

```bash
gh attestation verify Notation-Labs-X.Y.Z-Win.exe --repo kevinkickback/notation.LABS
```

## Keep dev synchronized

After a squash merge, merge production history back into `dev` before the next release. This keeps
the long-lived branches connected without rewriting `dev`:

```bash
git switch dev
git fetch origin
git merge origin/main
git push origin dev
```

Resolve conflicts and rerun checks on `dev`. This history synchronization does not create a release.

## Recover a failed release

For a transient runner or network failure, rerun all jobs. Cleanup removes an incomplete draft and
its workflow-created tag, so the exact original release commit can be retried safely:

```bash
gh run rerun RUN_ID
gh run watch RUN_ID --exit-status
```

The Release workflow can also be dispatched manually with the original squash commit as
`source-sha`. For source or workflow fixes, prepare a new patch version on `dev` and use another
`dev` to `main` PR. Never move or reuse a published version tag.
