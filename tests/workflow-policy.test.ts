import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const workflowPath = (name: string) => resolve(process.cwd(), '.github', 'workflows', name);
const readWorkflow = (name: string) => readFile(workflowPath(name), 'utf8');

describe('workflow policy', () => {
  test('keeps pull-request CI read-only and scoped to main', async () => {
    const workflow = await readWorkflow('ci.yml');

    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).not.toContain('branches: [dev, main]');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('name: Lint, type-check, test, and build');
    expect(workflow).toContain('name: Browser tests');
    expect(workflow).toContain('runs-on: ubuntu-26.04');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull-requests: write');
    expect(workflow).not.toContain('github.rest.pulls.merge');
  });

  test('uses GitHub native merging instead of a privileged merge workflow', async () => {
    await expect(access(workflowPath('merge.yml'))).rejects.toThrow();
  });

  test('creates a complete draft only from a manual current-main dispatch', async () => {
    const workflow = await readWorkflow('release.yml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('repository_dispatch:');
    expect(workflow).not.toContain('push:\n    branches: [main]');
    expect(workflow).toContain('Require the current main revision');
    expect(workflow).toContain("context.ref !== 'refs/heads/main'");
    expect(workflow).toContain('branch.commit.sha !== process.env.SOURCE_SHA');
    expect(workflow).toContain('node scripts/check-release.mjs --notes-file');
    expect(workflow).toContain('draft(s) already exist for $tag');
    expect(workflow).toContain('Tag $tag points to $existing_sha instead of $SOURCE_SHA');
    expect(workflow).not.toContain('rebuild-release');
    expect(workflow).not.toContain('merged dev to main');

    const buildJob = workflow.slice(
      workflow.indexOf('\n  build:'),
      workflow.indexOf('\n  publish-release:'),
    );
    expect(buildJob).toContain('permissions:\n      contents: read');
    expect(buildJob).toContain('npm run build:app');
    expect(buildJob).not.toContain('GH_TOKEN');
    expect(buildJob).not.toContain('contents: write');

    const publishJob = workflow.slice(
      workflow.indexOf('\n  publish-release:'),
      workflow.indexOf('\n  verify-release:'),
    );
    const validateIndex = publishJob.indexOf('Validate completed artifact bundle');
    const attestIndex = publishJob.indexOf('Attest build provenance');
    const mutateIndex = publishJob.indexOf('Create draft from completed artifacts');
    expect(validateIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeLessThan(attestIndex);
    expect(attestIndex).toBeLessThan(mutateIndex);
    expect(publishJob).toContain('Expected exactly 10 release artifacts');
    expect(publishJob).toContain('assert_current_main');
    expect(publishJob).toContain('assert_no_releases');
    expect(publishJob).toContain('gh release create "$RELEASE_TAG" release-artifacts/*');
    expect(publishJob).not.toContain('gh release edit');
    expect(publishJob).not.toContain('gh release upload');
    expect(publishJob).not.toContain('--method DELETE');
    expect(publishJob).not.toContain('--method PATCH');

    expect(workflow).toContain('Expected exactly one draft for $RELEASE_TAG');
    expect(workflow).toContain('Expected exactly 10 release assets');
    for (const name of [
      'Notation-Labs-$RELEASE_VERSION-Win.exe',
      'Notation-Labs-$RELEASE_VERSION-Win-Portable.exe',
      'Notation-Labs-$RELEASE_VERSION-Mac.dmg',
      'Notation-Labs-$RELEASE_VERSION-Linux.AppImage',
      'Notation-Labs-$RELEASE_VERSION-Linux.deb',
      'latest.yml',
      'latest-mac.yml',
      'latest-linux.yml',
    ]) {
      expect(workflow).toContain(name);
    }
  });

  test('pins every official action to an immutable commit', async () => {
    const workflows = await Promise.all(['ci.yml', 'release.yml'].map(readWorkflow));
    const actionUses = workflows.flatMap((workflow) =>
      [...workflow.matchAll(/uses:\s+(actions\/[^@\s]+)@([^\s#]+)/g)].map((match) => ({
        action: match[1],
        revision: match[2],
      })),
    );

    expect(actionUses.length).toBeGreaterThan(0);
    expect(actionUses.every(({ revision }) => /^[0-9a-f]{40}$/.test(revision))).toBe(true);
  });

  test('uses the Node 24 version file for repository-run Node jobs', async () => {
    const workflows = await Promise.all(['ci.yml', 'release.yml'].map(readWorkflow));
    const versionFiles = workflows.flatMap((workflow) =>
      [
        ...workflow.matchAll(
          /uses: actions\/setup-node@[^\n]+\n\s+with:\n\s+node-version-file: ([^\n]+)/g,
        ),
      ].map((match) => match[1].trim()),
    );

    expect(versionFiles).toEqual(['.nvmrc', '.nvmrc', '.nvmrc', '.nvmrc']);
    const nodeVersion = (await readFile(resolve(process.cwd(), '.nvmrc'), 'utf8')).trim();
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(nodeVersion.startsWith('24.')).toBe(true);
    expect(packageJson.engines.node).toBe('>=24.0.0');
  });
});
