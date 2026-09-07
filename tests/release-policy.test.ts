import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  version: '2.0.0',
  previous: '1.8.0',
  tag: 'v2.0.0',
  tagSha: 'dev-sha',
  tagTree: 'tree',
  parents: 'main-sha parent-sha',
  pr: {} as Record<string, unknown>,
  outputs: [] as string[],
}));

vi.mock('node:fs', () => { const mock = {
  readFileSync: () => JSON.stringify({ version: state.version }),
  appendFileSync: (_path: string, value: string) => state.outputs.push(value.trim()),
}; return { ...mock, default: mock }; });
vi.mock('node:child_process', () => { const mock = {
  execFileSync: (command: string, args: string[]) => {
    if (command === 'gh') return JSON.stringify([[state.pr]]);
    if (command !== 'git') return '';
    if (args[0] === 'rev-list') return state.parents;
    if (args[0] === 'show') return JSON.stringify({ version: state.previous });
    if (args[0] === 'tag') return state.tag;
    if (args[1].endsWith('^{commit}')) return state.tagSha;
    if (args[1] === 'main-sha^{tree}') return 'tree';
    return state.tagTree;
  },
}; return { ...mock, default: mock }; });

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.stubEnv('GITHUB_SHA', 'main-sha');
  vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo');
  vi.stubEnv('GITHUB_OUTPUT', 'output');
  vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('skipped'); });
  Object.assign(state, {
    version: '2.0.0', previous: '1.8.0', tag: 'v2.0.0', tagSha: 'dev-sha',
    tagTree: 'tree', parents: 'main-sha parent-sha', outputs: [],
    pr: { merged_at: '2026-09-07', merge_commit_sha: 'main-sha',
      base: { ref: 'main' }, head: { ref: 'dev', sha: 'dev-sha', repo: { full_name: 'owner/repo' } } },
  });
});

async function run() {
  // @ts-expect-error The workflow helper is a standalone Node ESM script.
  return import('../.github/release-source.mjs');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('accepts a tagged PR with identical trees despite squash changing the SHA', async () => {
  await run();
  expect(state.outputs).toEqual(['tag=v2.0.0', 'sha=main-sha', 'ready=true']);
});

test('skips a PR with no version tag', async () => {
  state.tag = '';
  await expect(run()).rejects.toThrow('skipped');
  expect(state.outputs).toEqual(['ready=false']);
});

test('skips a version already on main', async () => {
  state.previous = state.version;
  await expect(run()).rejects.toThrow('skipped');
  expect(state.outputs).toEqual(['ready=false']);
});

test.each([
  ['stale tag', () => { state.tagSha = 'old-dev'; }, 'final PR head'],
  ['changed merge tree', () => { state.tagTree = 'different'; }, 'differs'],
  ['merge commit', () => { state.parents += ' second-parent'; }, 'squash merge'],
  ['direct push', () => { state.pr = {}; }, 'merged dev -> main'],
  ['wrong merged commit', () => { state.pr.merge_commit_sha = 'other'; }, 'merged dev -> main'],
  ['fork dev branch', () => { state.pr.head = { ref: 'dev', repo: { full_name: 'fork/repo' } }; }, 'merged dev -> main'],
  ['prerelease version', () => { state.version = '2.0.0-beta.1'; }, 'stable X.Y.Z'],
] as const)('rejects %s', async (_name, change, message) => {
  change();
  await expect(run()).rejects.toThrow(message);
  expect(state.outputs).not.toContain('ready=true');
});
