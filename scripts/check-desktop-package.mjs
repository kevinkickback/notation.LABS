import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import asar from '@electron/asar';
import fuses from '@electron/fuses';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.argv[2] && resolve(process.argv[2]);
if (!executable)
  throw new Error(
    'Pass the packaged executable path (inside the .app bundle on macOS)',
  );
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const lockfile = JSON.parse(
  await readFile(join(root, 'package-lock.json'), 'utf8'),
);
const resources =
  process.platform === 'darwin'
    ? resolve(dirname(executable), '../Resources')
    : join(dirname(executable), 'resources');
const archive = join(resources, 'app.asar');
const entries = asar
  .listPackage(archive)
  .map((path) => path.replaceAll('\\', '/'));
assert(
  !entries.some((path) => path.startsWith('/node_modules')),
  'The packaged app must not include already bundled dependencies',
);
const packagedMetadata = JSON.parse(
  asar.extractFile(archive, 'package.json').toString('utf8'),
);
assert.equal(packagedMetadata.version, metadata.version);
assert.equal(packagedMetadata.name, metadata.name);
assert.equal(packagedMetadata.main, metadata.main);
assert.equal(packagedMetadata.dependencies, undefined);
for (const file of [
  'dist/index.html',
  'dist-electron/main.js',
  'dist-electron/preload.mjs',
  'LICENSE',
  'dist/THIRD_PARTY_NOTICES.txt',
  'dist-electron/THIRD_PARTY_NOTICES.txt',
])
  assert(entries.includes(`/${file}`), `Missing ${file}`);
assert(
  asar
    .extractFile(archive, 'dist/THIRD_PARTY_NOTICES.txt')
    .toString('utf8')
    .includes('react@'),
  'Renderer dependency notices are required',
);
assert(
  asar
    .extractFile(archive, 'dist-electron/THIRD_PARTY_NOTICES.txt')
    .toString('utf8')
    .includes('electron-updater@'),
  'Desktop dependency notices are required',
);
await access(join(resources, 'icon.ico'));
if (process.platform === 'win32') await access(join(resources, 'elevate.exe'));
const updater = await readFile(join(resources, 'app-update.yml'), 'utf8');
assert(
  updater.includes('provider: github') &&
    updater.includes('repo: notation.LABS'),
  'Updater configuration must be preserved',
);
const fuseWire = await fuses.getCurrentFuseWire(executable);
for (const [option, enabled] of [
  ['RunAsNode', false],
  ['EnableCookieEncryption', true],
  ['EnableNodeOptionsEnvironmentVariable', false],
  ['EnableNodeCliInspectArguments', false],
  ['EnableEmbeddedAsarIntegrityValidation', true],
  ['OnlyLoadAppFromAsar', true],
])
  assert.equal(
    fuseWire[fuses.FuseV1Options[option]],
    enabled ? 49 : 48,
    `Unexpected security fuse: ${option}`,
  );

// CDP controls Chromium only; the shipped binary keeps its Node inspector disabled.
const server = createServer();
await new Promise((done, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', done);
});
const port = server.address().port;
await new Promise((done, reject) =>
  server.close((error) => (error ? reject(error) : done())),
);
await mkdir(join(root, '.tmp'), { recursive: true });
const profile = await mkdtemp(join(root, '.tmp', 'package-smoke-'));
if (
  dirname(profile) !== join(root, '.tmp') ||
  !basename(profile).startsWith('package-smoke-')
)
  throw new Error('Invalid smoke profile directory');
const child = spawn(
  executable,
  [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);
let launchError;
let output = '';
child.on('error', (error) => {
  launchError = error;
});
const exited = new Promise((done) => child.once('exit', done));
child.stderr.on('data', (chunk) => {
  output = (output + chunk.toString()).slice(-8000);
});
let browser;
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (launchError) throw launchError;
    if (child.exitCode !== null)
      throw new Error(`Packaged app exited ${child.exitCode}: ${output}`);
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        timeout: 1000,
      });
      break;
    } catch {
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  if (!browser) throw new Error(`Packaged app did not start: ${output}`);
  const context = browser.contexts()[0];
  assert(context, 'Packaged app did not expose its Chromium context');
  const page = context.pages()[0] ?? (await context.waitForEvent('page'));
  await page.getByRole('button', { name: /add your first game/i }).waitFor();
  const runtime = await page.evaluate(async () => {
    await window.electronAPI.setAutoCheck(false);
    return {
      version: await window.electronAPI.getAppVersion(),
      electron: window.electronAPI.versions.electron,
      status: await window.electronAPI.getUpdateStatus(),
      node: typeof window.require,
      protocol: location.protocol,
    };
  });
  assert.equal(runtime.version, metadata.version);
  assert.equal(
    runtime.electron,
    lockfile.packages['node_modules/electron'].version,
  );
  assert.equal(runtime.node, 'undefined');
  assert.equal(runtime.protocol, 'file:');
  assert.equal(typeof runtime.status.status, 'string');
  assert.equal(typeof runtime.status.revision, 'number');
  await page.getByRole('button', { name: /add your first game/i }).click();
  const editor = page.getByRole('dialog', {
    name: 'Add New Game',
    exact: true,
  });
  await editor.getByLabel('Game Name').fill('Packaged smoke game');
  await editor.getByRole('button', { name: 'Add Game', exact: true }).click();
  await page
    .getByRole('button', { name: 'Edit Packaged smoke game' })
    .waitFor();
  const bell = page.locator('.notification-bell');
  await bell.click();
  await page
    .getByRole('dialog', { name: 'Notifications', exact: true })
    .getByText('Game added', { exact: true })
    .waitFor();
  await page.keyboard.press('Escape');
  await page.reload();
  await page
    .getByRole('button', { name: 'Edit Packaged smoke game' })
    .waitFor();
  assert.equal(
    await page
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Game added' })
      .count(),
    0,
  );
  await bell.click();
  await page
    .getByRole('dialog', { name: 'Notifications', exact: true })
    .getByText('Game added', { exact: true })
    .waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: 'Choose backup file', exact: true })
    .click();
  await (await chooser).setFiles({
    name: 'invalid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  });
  await page
    .locator('[data-sonner-toast]')
    .filter({ hasText: 'Failed to import data:' })
    .waitFor();
  await bell.click();
  await page
    .getByRole('dialog', { name: 'Notifications', exact: true })
    .locator('li')
    .filter({ hasText: 'Failed to import data:' })
    .getByRole('button', { name: 'Copy error' })
    .click();
  await page
    .locator('[data-sonner-toast]')
    .filter({ hasText: 'Error copied' })
    .waitFor();
  console.log(
    JSON.stringify({
      version: runtime.version,
      electron: runtime.electron,
      archiveBytes: (await stat(archive)).size,
      archiveEntries: entries.length,
      persistence: 'passed',
      notificationHistory: 'passed',
      preload: 'passed',
      updaterResources: 'passed',
      securityFuses: 'passed',
    }),
  );
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    child.kill();
    await Promise.race([exited, new Promise((done) => setTimeout(done, 5000))]);
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}
