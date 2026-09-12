# CI/CD and release workflow

`dev` is the integration branch and `main` is the stable production branch. Short-lived branches
merge into `dev`; `main` receives only squash merges from a same-repository `dev` to `main` pull
request. Do not push commits or tags directly to `main`.

## Repository setup

Configure GitHub's **Main Protection** ruleset to:

- protect `main` from direct and force pushes and branch deletion;
- require the branch to be up to date before merging;
- allow squash merging only;
- require resolved review conversations;
- require these exact status checks:
  - **Lint, type-check, test, and build**
  - **Browser tests**
- retain `dev` after a production merge; and
- enable immutable releases so future published assets and their `vX.Y.Z` tags cannot be changed.

Release immutability applies only to releases published after it is enabled. Protect the exact tags
for older published releases separately; do not apply a wildcard tag rule that would prevent the
workflow from replacing an unpublished draft tag during an explicit rebuild.

The repository's default Actions token permission can remain read-only. The protected merge and
release workflows request write access only for the jobs that must merge a PR, create a repository
dispatch, attest artifacts, or create a draft release.

The workflow files do not configure repository rulesets. After installing these workflows, update
the required status checks manually: the previous **Lint, type-check, and test** context is obsolete.

## CI and merging

`ci.yml` runs for non-draft pull requests targeting `dev` or `main`. It validates release metadata,
audits production dependencies, runs Biome and TypeScript, executes Vitest with coverage, builds the
web app, and runs Playwright in a separate job. Feature PRs into `dev` are checked but never
auto-merged. Repository-run Node commands use the Node 24 version in `.nvmrc`, matching the package
engine requirement.

After CI completes, `merge.yml` runs from protected `main`. For a ready, same-repository `dev` to
`main` PR, it confirms that both required jobs passed exactly once for the current head revision and
that `main` still matches the tested base revision. It then squash-merges that exact revision and
dispatches the resulting commit to the protected release workflow. Copilot review is advisory and
runs independently; it never delays or controls CI or merging.

Changes to these release-infrastructure paths are deliberately excluded from automatic merging:

- `.github/workflows/**`
- `.github/scripts/**`
- `scripts/check-release.mjs`

Those changes require an explicit maintainer merge after CI passes. This prevents a pull request
from redefining the privileged workflow or validation code that would approve the same pull request.

### One-time workflow bootstrap

GitHub loads a `workflow_run` workflow from the default branch. The pull request that installs this
architecture must therefore be squash-merged manually after both CI checks pass. Update the Main
Protection ruleset to the two exact check names above before merging. Later release-infrastructure
changes use the same manual exception.

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

No merge command is needed for ordinary application or version changes. Once repository
requirements and CI pass, the protected merge workflow squash-merges the exact checked revision. If
the PR or `main` changes after CI, the latest revision must pass before merging.

Release-infrastructure changes are the exception: merge those manually only after both CI jobs pass.
The resulting `main` push loads the updated release workflow from the protected branch.

## Automated release

The complete flow is:

**PR → deterministic CI → protected squash merge → read-only package builds → exact bundle
validation → attestation → draft release → manual review → manual publish**

For a version-changing squash commit, `release.yml`:

1. Confirms the source is associated with a merged, same-repository `dev` to `main` PR.
2. Uses the protected `main` copy of `scripts/check-release.mjs` to require an increased stable
   `X.Y.Z` version, synchronized package metadata, and a matching nonempty changelog.
3. Builds Windows, macOS, and Linux packages on native runners without repository write credentials.
4. Downloads the completed packages into one trusted job and validates the exact ten-file bundle,
   including the filenames referenced by all three updater manifests.
5. Records build provenance, re-checks every matching release and tag, and replaces matching
   unpublished drafts with one clean draft. Published releases are never modified.
6. Verifies the draft body, tag target, exact filenames, file count, and nonempty assets.

Ordinary merges with an unchanged package version stop after version detection. Runs are serialized
with the `release-main` concurrency group. The workflow never publishes a release.

| Platform | Required draft assets |
|---|---|
| Windows | `Notation-Labs-X.Y.Z-Win.exe`, `Notation-Labs-X.Y.Z-Win-Portable.exe`, `Notation-Labs-X.Y.Z-Win.exe.blockmap`, `latest.yml` |
| macOS | `Notation-Labs-X.Y.Z-Mac.dmg`, `Notation-Labs-X.Y.Z-Mac.dmg.blockmap`, `latest-mac.yml` |
| Linux | `Notation-Labs-X.Y.Z-Linux.AppImage`, `Notation-Labs-X.Y.Z-Linux.deb`, `latest-linux.yml` |

Existing packaging and signing configuration remains unchanged.

## Review and publish

```bash
gh run list --workflow release.yml --limit 5
gh run watch RUN_ID --exit-status
gh release view vX.Y.Z --json tagName,name,isDraft,isPrerelease,body,assets,url
gh release edit vX.Y.Z --draft=false
```

Check the release notes, all ten assets, the Windows portable binary, updater manifests, and any
background Copilot findings before publishing. Once published, release immutability locks its assets
and associated tag. Attestations can be verified with GitHub CLI:

```bash
gh attestation verify Notation-Labs-X.Y.Z-Win.exe --repo kevinkickback/notation.LABS
```

## Rebuild an unpublished release

Normal retries are idempotent. A published release always stops the workflow; matching drafts are
removed only after a complete replacement bundle validates. A matching tag without a release is
reused to finish interrupted draft creation.

After corrective code is merged without another version bump, leave the existing unpublished draft
and tag in place and request an explicit rebuild of the corrected `main` commit:

```bash
gh api --method POST repos/kevinkickback/notation.LABS/dispatches \
  -f event_type=rebuild-release \
  -f 'client_payload[source_sha]=<corrected-main-sha>'
```

Rebuild mode is valid only when the package version is unchanged. It builds and validates the full
replacement bundle first, enumerates every release using the tag, refuses to modify any published
release, and then replaces matching drafts and the tag. Do not publish the draft while a rebuild is
active.

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

## Recover from failures

Inspect the separate merge and release runs:

```bash
gh run list --workflow merge.yml --limit 5
gh run list --workflow release.yml --limit 5
gh run view RUN_ID
```

- For a transient build or network failure, rerun the failed jobs. No tag or draft is created before
  every platform build and bundle check succeeds.
- If draft creation is interrupted after cleanup, rerun the workflow; it safely resumes from the
  remaining tag or recreates the draft.
- For corrected source using the same unpublished version, use the explicit rebuild event above.
- If the version is already published, make corrections in a new version. Never move or reuse a
  published version tag.
