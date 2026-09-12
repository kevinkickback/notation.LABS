import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const readWorkflow = (name: string) =>
  readFile(resolve(process.cwd(), '.github', 'workflows', name), 'utf8');

describe('trusted workflow policy', () => {
  test('keeps pull-request CI read-only', async () => {
    const workflow = await readWorkflow('ci.yml');

    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('branches: [dev, main]');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull-requests: write');
    expect(workflow).not.toContain('github.rest.pulls.merge');
    expect(workflow).not.toContain('uses: ./.github/workflows/release.yml');
  });

  test('merges only the exact tested application revision from protected code', async () => {
    const workflow = await readWorkflow('merge.yml');

    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain('workflows: [CI]');
    expect(workflow).toContain('github.rest.actions.listJobsForWorkflowRun');
    expect(workflow).toContain("'Lint, type-check, test, and build'");
    expect(workflow).toContain("'Browser tests'");
    expect(workflow).toContain("matches[0].conclusion !== 'success'");
    expect(workflow).toContain("pr.base.ref !== 'main'");
    expect(workflow).toContain("pr.head.ref !== 'dev'");
    expect(workflow).toContain('pr.head.sha !== testedPull.head.sha');
    expect(workflow).toContain('currentBase.commit.sha !== testedBase');
    expect(workflow).toContain('github.rest.pulls.listFiles');
    expect(workflow).toContain("path.startsWith('.github/workflows/')");
    expect(workflow).toContain("path.startsWith('.github/scripts/')");
    expect(workflow).toContain("path === 'scripts/check-release.mjs'");
    expect(workflow).toContain('Release infrastructure changes require a manual merge');
    expect(workflow).toContain("event_type: 'release-merged'");
    expect(workflow).toContain('github.rest.repos.createDispatchEvent');
    expect(workflow).not.toContain('Copilot');
    expect(workflow).not.toContain('actions/checkout');
    expect(workflow).not.toContain('npm ci');
  });

  test('builds and validates every package before creating a clean draft', async () => {
    const workflow = await readWorkflow('release.yml');

    expect(workflow).toContain('push:\n    branches: [main]');
    expect(workflow).toContain('repository_dispatch:');
    expect(workflow).toContain('types: [release-merged, rebuild-release]');
    expect(workflow).not.toContain('workflow_call:');
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).toContain(`ref: \${{ github.workflow_sha || github.sha }}`);
    expect(workflow).toContain(
      'node ../trusted/scripts/check-release.mjs \\\n              --source-root .',
    );
    expect(workflow).toContain('needs: [release-source, build]');
    expect(workflow).toContain('Validate completed artifact bundle');
    expect(workflow).toContain('Expected exactly 10 release artifacts');
    expect(workflow).toContain('Expected exactly 10 release assets');
    expect(workflow).toContain('Expected exactly one draft');
    expect(workflow).toContain("require_manifest 'latest.yml'");
    expect(workflow).toContain("require_manifest 'latest-mac.yml'");
    expect(workflow).toContain("require_manifest 'latest-linux.yml'");

    const buildJob = workflow.slice(
      workflow.indexOf('\n  build:'),
      workflow.indexOf('\n  publish-release:'),
    );
    expect(buildJob).toContain('permissions:\n      contents: read');
    expect(buildJob).not.toContain('GH_TOKEN');
    expect(buildJob).not.toContain('contents: write');
    expect(buildJob).not.toContain('actions/attest');

    const publishJob = workflow.slice(
      workflow.indexOf('\n  publish-release:'),
      workflow.indexOf('\n  verify-release:'),
    );
    const validateIndex = publishJob.indexOf('Validate completed artifact bundle');
    const attestIndex = publishJob.indexOf('Attest build provenance');
    const mutateIndex = publishJob.indexOf('Replace or create draft from completed artifacts');
    expect(validateIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeLessThan(attestIndex);
    expect(attestIndex).toBeLessThan(mutateIndex);
    expect(publishJob).toContain('assert_draft "\$release_id"');
    expect(publishJob).toContain('Release \$RELEASE_TAG is published; refusing to modify it.');
    expect(publishJob).toContain('gh release create "\$RELEASE_TAG" release-artifacts/*');
    expect(publishJob).not.toContain('gh release upload');
  });

  test('pins every official action to an immutable commit', async () => {
    const workflows = await Promise.all(
      ['ci.yml', 'merge.yml', 'release.yml'].map((name) => readWorkflow(name)),
    );
    const actionUses = workflows.flatMap((workflow) =>
      [...workflow.matchAll(/uses:\s+(actions\/[^@\s]+)@([^\s#]+)/g)].map((match) => ({
        action: match[1],
        revision: match[2],
      })),
    );

    expect(actionUses.length).toBeGreaterThan(0);
    expect(actionUses.every(({ revision }) => /^[0-9a-f]{40}$/.test(revision))).toBe(true);
  });

  test('uses the Node 24 version file for every repository-run Node job', async () => {
    const ci = await readWorkflow('ci.yml');
    const release = await readWorkflow('release.yml');
    const setupVersionFiles = [ci, release].flatMap((workflow) =>
      [
        ...workflow.matchAll(
          /uses: actions\/setup-node@[^\n]+\n\s+with:\n\s+node-version-file: ([^\n]+)/g,
        ),
      ].map((match) => match[1].trim()),
    );

    expect(setupVersionFiles).toEqual([
      '.nvmrc',
      '.nvmrc',
      '.nvmrc',
      'source/.nvmrc',
      '.nvmrc',
    ]);

    const nodeVersion = (await readFile(resolve(process.cwd(), '.nvmrc'), 'utf8')).trim();
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(nodeVersion.startsWith('24.')).toBe(true);
    expect(packageJson.engines.node).toBe('>=24.0.0');
  });
});
