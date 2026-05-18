# CI/CD Workflow

## Branches

| Branch | Purpose |
|--------|---------|
| `dev` | All active development happens here |
| `main` | Stable branch — only updated via PR from `dev` |

---

## Day-to-day development

Work on `dev`. Every push automatically runs lint, type-check, and tests in GitHub Actions. Fix anything that fails before continuing.

```bash
git add .
git commit -m "your message"
git push
```

---

## Releasing a new version

Follow these steps **in order**. Skipping or reordering steps will cause the build to silently skip artifact uploads (see [Critical gotcha](#critical-gotcha-do-not-pre-create-the-release) below).

### Step 1 — Bump the version in `package.json`

```json
"version": "1.5.0"
```

### Step 2 — Commit and push to `dev`

```bash
git add package.json
git commit -m "chore: bump version to 1.5.0"
git push
```

### Step 3 — Open a PR from `dev` → `main` and merge it

Using the GitHub CLI:
```bash
gh pr create --base main --head dev --title "Release v1.5.0" --body "Release notes here"
gh pr merge <PR_NUMBER> --merge --repo kevinkickback/notation.LABS
```

### Step 4 — Push the tag from `main`

**Do NOT create the GitHub Release manually before pushing the tag.** Just push the tag and let the workflow do the rest.

```bash
git checkout main
git pull
git tag v1.5.0
git push origin v1.5.0
git checkout dev
```

Pushing the tag triggers the `release.yml` workflow, which:
1. Builds the app on Windows, macOS (arm64), and Linux in parallel
2. Has electron-builder **automatically create a draft release** and upload all artifacts to it
3. Publishes the draft once all uploads succeed

The release will contain:
| File | Platform |
|------|----------|
| `notation-labs-Setup-<version>.exe` + `.exe.blockmap` | Windows installer |
| `notation-labs-<version>-portable.exe` | Windows portable |
| `notation-labs-<version>-arm64.dmg` + `.dmg.blockmap` | macOS (Apple Silicon) |
| `notation-labs-<version>.AppImage` | Linux |
| `latest.yml`, `latest-mac.yml`, `latest-linux.yml` | Auto-update manifests |

---

## Critical gotcha — do NOT pre-create the release

electron-builder (`--publish always`) uploads artifacts into a **draft** GitHub Release that it creates itself when it finds none. If a published (non-draft) release already exists for the tag, electron-builder logs:

```
GitHub release not created  reason=existing type not compatible with publishing type
existingType=release publishingType=draft
skipped publishing  file=... reason=existing type not compatible...
```

...and silently skips every upload. The workflow exits with status `success` even though no files were attached.

**Rules:**
- Never run `gh release create` before the build workflow has finished.
- If you accidentally pre-created a published release, convert it to a draft first, then re-run the workflow:
  ```bash
  gh release edit v1.5.0 --draft=true --repo kevinkickback/notation.LABS
  gh run rerun <RUN_ID> --repo kevinkickback/notation.LABS
  # wait for the run to complete, then publish:
  gh release edit v1.5.0 --draft=false --repo kevinkickback/notation.LABS
  ```
- After the workflow completes, verify assets are attached before considering the release done:
  ```bash
  gh release view v1.5.0 --repo kevinkickback/notation.LABS --json assets | ConvertFrom-Json
  # Must show at least 9 files; an empty assets array means uploads were skipped.
  ```

---

## Tag format

Tags must start with `v` followed by a number: `v1.5.0`, `v1.5.1`, `v2.0.0-beta`.

---

## If a release build fails

Go to the **Actions** tab on GitHub, open the failed run, and check which platform failed. Each platform builds independently — a failure on one does not cancel the others.

To inspect logs via CLI:
```bash
gh run list --repo kevinkickback/notation.LABS --workflow release.yml --limit 5
gh run view <RUN_ID> --repo kevinkickback/notation.LABS
gh run view --repo kevinkickback/notation.LABS --job <JOB_ID> --log
```

Fix the issue on `dev`, open a new PR, merge, and re-tag. Delete the broken tag and release first:
```bash
gh release delete v1.5.0 --repo kevinkickback/notation.LABS --yes
git push origin --delete v1.5.0
git tag -d v1.5.0
```
