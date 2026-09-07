# CI/CD and Release Workflow

All development happens on `dev`. `main` is production only and receives squash
merges from `dev`. A release requires a new stable `vX.Y.Z` tag on the final PR
head, matching package metadata and `changelogs/vX.Y.Z.md`.

## Repository setup (once)

In GitHub repository settings:

- Protect `main`: require a pull request, disallow direct/force pushes and branch
  deletion, and require `Validate production PR`, `Lint, type-check, and test`,
  and `Browser tests`. Set required approvals to zero for unattended releases.
  Apply these rules to administrators as appropriate.
- Enable squash merging and disable merge commits and rebase merging. Keep `dev`
  after merging (disable automatic head-branch deletion).
- Give workflows read and write permission. The CI workflow grants write access
  only to its merge job, while the release workflow grants it only to draft
  management jobs. The built-in `GITHUB_TOKEN` is sufficient; no PAT is needed.
- Protect release tags against updates/deletion to preserve release provenance.

These repository settings are not applied by committing workflow files. Land
these files on `dev` before preparing the next release; `main` receives them in
that release PR. No workflow creates a PR or changes repository settings for you.

## Daily development and CI

Use the Node version in `.nvmrc` and `npm ci`. Push development work to `dev`.
`ci.yml` runs version consistency checks, production dependency auditing, Biome,
TypeScript, Vitest with coverage thresholds, and Playwright browser tests. PRs
to `main` run the same checks on GitHub's proposed merge commit. `Validate
production PR` accepts only this repository's `dev` branch and requires a
matching tag and non-empty changelog for version changes.

After all three PR jobs pass, a qualifying tagged PR is squash-merged
automatically and explicitly dispatches the release workflow. The release
workflow verifies that the tag and production commit contain identical files,
then stages the release without repeating the checks that already passed on the
proposed merge. Ordinary development pushes never create releases. A PR with an
unchanged package version is tested but remains open and does not release. A
version-changing PR without its matching tag fails validation.

## 1. Prepare a release on dev

Run commands from the repository root, replacing `X.Y.Z` with a stable version
such as `1.9.0`. Prereleases are deliberately unsupported by this production
pipeline, which retains the application's `latest*.yml` updater channels.

```bash
git switch dev
git pull --ff-only
npm ci
npm version X.Y.Z --no-git-tag-version
```

Write `changelogs/vX.Y.Z.md` with non-empty user-facing release notes. The entire
file becomes the draft body, exactly as committed. Keep `package.json` and both
root version fields in `package-lock.json` synchronized.

Run the release checks before committing:

```bash
npm run version:check -- --tag=vX.Y.Z
npm audit --omit=dev --audit-level=high
npm run lint
npx tsc -b
npm run test:coverage
npx playwright install chromium
npm run test:e2e
git diff --check
```

Linux may need `npx playwright install --with-deps chromium`. Include all required
packaging resources from `build/` in the commit.

## 2. Commit and push dev with the tag

```bash
git add package.json package-lock.json changelogs/vX.Y.Z.md
# Stage any other intended release changes explicitly.
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push --atomic origin dev vX.Y.Z
```

The atomic push sends the branch and tag together. The tag must point to the
final PR head, not an earlier commit. Pushing a tag alone does not build a
release. Never manually create the GitHub release or move a published tag.

## 3. Open the release PR

```bash
gh pr create --base main --head dev --title "Release vX.Y.Z" --body-file changelogs/vX.Y.Z.md
gh pr checks PR_NUMBER --watch
```

Replace `PR_NUMBER` with the created PR number. No merge command is needed. After
the tag policy, quality checks, and browser tests pass, the final CI job squash
merges the PR and dispatches the release workflow with the exact merge commit.
Do not delete `dev`.

If you add commits after tagging, the PR gate fails until a new release tag
matches the final head. Prefer a fresh patch version and changelog, then push
that new tag with `dev`. Re-run PR checks if only a tag was pushed, since tag
pushes do not trigger PR CI.

Squash merging changes the commit hash. The tag remains on the reviewed `dev`
commit; it is never moved to `main`. The workflow requires identical Git trees
between that tag and the squash commit, then tests and builds from the exact
`main` commit. Thus the tagged source and packaged source contain the same files.
See [GitHub's merge-method documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github).

## 4. Automated release

The automated merge dispatches `release.yml`; a human merge still starts it from
the normal `main` push event. It:

1. Requires an associated merged same-repository `dev` to `main` PR and a
   single-parent production commit (configure squash-only merges as above).
2. Skips releases without a version change or corresponding tag. Otherwise,
   validates the final PR head, matching source trees, stable package version,
   lockfile versions, and non-empty changelog.
3. Creates or refreshes the draft using the committed changelog. Published
   releases are refused. `--verify-tag` prevents accidental tag creation.
4. Builds Windows, macOS, and Linux packages on native runners using this
   project's `npm run build:app` and `electron-builder --publish never`.
5. Stages binaries, update manifests, and blockmaps as one-day Actions artifacts,
   then uploads them in one controlled job, replacing same-named draft assets.
6. Verifies draft status, exact notes, required filenames, and non-empty assets.
7. Deletes an incomplete draft after a downstream failure or cancellation. It
   never deletes a tag or an already published release.

Runs are serialized with `release-main` concurrency. GitHub may replace pending
runs, so complete one release before merging the next. Do not publish a draft
while a release run is in progress. Release creation uses the existing tag as
specified by the [GitHub CLI](https://cli.github.com/manual/gh_release_create).

| Platform | Required draft assets |
|---|---|
| Windows | `Notation-Labs-X.Y.Z-Win.exe`, `Notation-Labs-X.Y.Z-Win-Portable.exe`, `Notation-Labs-X.Y.Z-Win.exe.blockmap`, `latest.yml` |
| macOS | `Notation-Labs-X.Y.Z-Mac.dmg`, `Notation-Labs-X.Y.Z-Mac.dmg.blockmap`, `latest-mac.yml` |
| Linux | `Notation-Labs-X.Y.Z-Linux.AppImage`, `Notation-Labs-X.Y.Z-Linux.deb`, `latest-linux.yml` |

The staging globs retain additional generated blockmaps. Existing packaging and
signing configuration is used without adding signing credentials.

## 5. Review and publish

```bash
gh run list --workflow release.yml --branch main --limit 5
gh run watch RUN_ID --exit-status
gh release view vX.Y.Z --json tagName,name,isDraft,isPrerelease,body,assets,url
```

After the entire workflow succeeds, review notes and packages, then publish:

```bash
gh release edit vX.Y.Z --draft=false
gh release view vX.Y.Z --json tagName,isDraft,publishedAt,url,assets
```

Publishing is intentionally manual; automated work ends with a verified draft.

## Keep dev synchronized after squash merges

Before the next release, merge the production history back into `dev`. This
keeps the long-lived branches connected without resetting or force-pushing dev:

```bash
git switch dev
git fetch origin
git merge origin/main
git push origin dev
```

Resolve any conflicts on `dev`, run checks, and commit before preparing the next
tag. This history-only synchronization does not trigger a release.

## Recover a failed release

For transient runner/network failures, rerun **all jobs**, since automatic
cleanup removes incomplete drafts:

```bash
gh run rerun RUN_ID
gh run watch RUN_ID --exit-status
```

The existing tag and immutable production commit are reused. Successful draft
reruns refresh notes and assets; published releases are refused. Cleanup only
runs when draft preparation succeeded, so a failed attempt to replace a
published release cannot remove it. If cleanup itself failed, inspect the draft
and delete only that unpublished draft before retrying.

For source or configuration fixes, work on `dev` and prepare a new patch version
and tag, then open another release PR. Do not rerun an old workflow expecting it
to use newer code, and never reuse or move published tags. A missing tag on an
already merged PR does not start a release when pushed later; prepare the next
version through the documented sequence instead.
