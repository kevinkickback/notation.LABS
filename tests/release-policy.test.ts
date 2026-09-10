import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  packageVersion: '2.0.0',
  lockVersion: '2.0.0',
  rootLockVersion: '2.0.0',
  changelog: '# Changes\n\n- New release',
  writes: [] as Array<{ path: string; contents: string }>,
}));

vi.mock('node:fs/promises', () => {
  const mock = {
    readFile: (url: URL) => {
      const path = url.pathname.replace(/\\/g, '/');
    if (path.endsWith('/package.json')) {
      return JSON.stringify({ version: state.packageVersion });
    }
    if (path.endsWith('/package-lock.json')) {
      return JSON.stringify({
        version: state.lockVersion,
        packages: { '': { version: state.rootLockVersion } },
      });
    }
    if (path.endsWith(`/changelogs/v${state.packageVersion}.md`)) {
      return state.changelog;
    }
    throw new Error(`Missing mocked file: ${path}`);
    },
    writeFile: (path: string, contents: string) => {
      state.writes.push({ path, contents });
    },
  };
  return { ...mock, default: mock };
});

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  Object.assign(state, {
    packageVersion: '2.0.0',
    lockVersion: '2.0.0',
    rootLockVersion: '2.0.0',
    changelog: '# Changes\n\n- New release',
    writes: [],
  });
  process.argv = ['node', 'scripts/check-release.mjs'];
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function run() {
  // @ts-expect-error The release validator is a standalone Node ESM script.
  return import('../scripts/check-release.mjs');
}

test('accepts synchronized stable metadata with a versioned changelog', async () => {
  await expect(run()).resolves.toBeDefined();
  expect(state.writes).toEqual([]);
});

test('extracts the committed changelog for draft release notes', async () => {
  process.argv.push('--notes-file', 'release-notes.md');

  await run();

  expect(state.writes).toEqual([
    {
      path: 'release-notes.md',
      contents: '# Changes\n\n- New release\n',
    },
  ]);
});

test.each([
  [
    'prerelease version',
    () => {
      state.packageVersion = '2.0.0-beta.1';
    },
    'stable X.Y.Z',
  ],
  [
    'lockfile version mismatch',
    () => {
      state.lockVersion = '1.9.0';
    },
    'Version metadata does not match',
  ],
  [
    'root lockfile version mismatch',
    () => {
      state.rootLockVersion = '1.9.0';
    },
    'Version metadata does not match',
  ],
  [
    'empty changelog',
    () => {
      state.changelog = '   ';
    },
    'changelog is empty',
  ],
] as const)('rejects %s', async (_name, change, message) => {
  change();
  await expect(run()).rejects.toThrow(message);
});
