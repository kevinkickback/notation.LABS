import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  access,
  mkdir,
  mkdtemp,
  open,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import asar from '@electron/asar';
import { chromium } from 'playwright';

// Deliberately separate from routine CI: real disk-backed ZIP64 and native Blob storage.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const executable = resolve(
  process.argv[2] ?? join(root, 'release/win-unpacked/Notation Labs.exe'),
);
await access(executable);
const count = Number(process.env.BACKUP_FIXTURE_VIDEOS ?? 65_536);
const mediaBytes = Number(
  process.env.BACKUP_FIXTURE_BYTES ?? 4 * 1024 ** 3 + 64 * 1024 ** 2,
);
assert(Number.isSafeInteger(count) && count >= 1000);
assert(Number.isSafeInteger(mediaBytes) && mediaBytes > 500 * 1024 ** 2);
await mkdir(join(root, '.tmp'), { recursive: true });
const directory = await mkdtemp(join(root, '.tmp', 'backup-validation-'));
assert.equal(dirname(directory), join(root, '.tmp'));
assert(basename(directory).startsWith('backup-validation-'));
const fixture = join(directory, 'large-video.mp4');
const fixtureHandle = await open(fixture, 'wx');
await fixtureHandle.truncate(mediaBytes);
await fixtureHandle.write(Buffer.from('backup-fixture-start'), 0, 20, 0);
await fixtureHandle.write(
  Buffer.from('backup-fixture-end'),
  0,
  18,
  mediaBytes - 18,
);
await fixtureHandle.close();
const archivePath = process.env.BACKUP_EXISTING_ARCHIVE
  ? resolve(process.env.BACKUP_EXISTING_ARCHIVE)
  : join(directory, 'library.zip');
const hashFile = async (path) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
};
const expectedHash = await hashFile(fixture);
const resources =
  process.platform === 'darwin'
    ? resolve(dirname(executable), '../Resources')
    : join(dirname(executable), 'resources');
const appArchive = join(resources, 'app.asar');
const assets = asar
  .listPackage(appArchive)
  .filter((path) => /\/dist\/assets\/.*\.js$/.test(path.replaceAll('\\', '/')));
let workerCode;
for (const path of assets) {
  const source = asar
    .extractFile(appArchive, path.replace(/^[/\\]/, ''))
    .toString('utf8');
  // Read only a complete quoted constant from our own built artifact, not arbitrary executable code.
  for (const match of source.matchAll(
    /(?:const|var|let)\s+[$\w]+=('(?:[^'\\]|\\.){5000,}'|"(?:[^"\\]|\\.){5000,}")/g,
  )) {
    const value = runInNewContext(match[1], {}, { timeout: 1000 });
    if (
      typeof value === 'string' &&
      value.includes('FightingGameComboTracker') &&
      value.includes('postMessage')
    )
      workerCode = value;
  }
}
assert(workerCode, 'Packaged transfer worker was not found');
const server = createServer();
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
await new Promise((done) => server.close(done));
const profile = join(directory, 'profile');
const child = spawn(
  executable,
  [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);
let output = '';
child.stderr.on('data', (chunk) => {
  output = (output + chunk).slice(-8000);
});
console.log(JSON.stringify({ processId: child.pid, directory }));
let memoryProbe;
const processMemory = [];
if (process.platform === 'win32') {
  const probeCommand = `while (Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue) {
    $taskAll = Get-CimInstance Win32_Process
    $taskIds = [System.Collections.Generic.HashSet[int]]::new()
    [void]$taskIds.Add(${child.pid})
    do { $taskChanged = $false; foreach ($taskProcess in $taskAll) { if ($taskIds.Contains($taskProcess.ParentProcessId) -and $taskIds.Add($taskProcess.ProcessId)) { $taskChanged = $true } } } while ($taskChanged)
    $taskProcesses = Get-Process -Id @($taskIds) -ErrorAction SilentlyContinue
    [pscustomobject]@{ time = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); working = ($taskProcesses | Measure-Object WorkingSet64 -Sum).Sum; private = ($taskProcesses | Measure-Object PrivateMemorySize64 -Sum).Sum; processes = @($taskProcesses | ForEach-Object { $taskPid = $_.Id; [pscustomobject]@{ id = $taskPid; private = $_.PrivateMemorySize64; command = ($taskAll | Where-Object ProcessId -eq $taskPid).CommandLine } }) } | ConvertTo-Json -Compress -Depth 3
    Start-Sleep -Seconds 2
  }`;
  memoryProbe = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', probeCommand],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  let pending = '';
  memoryProbe.stdout.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) {
      try {
        processMemory.push(JSON.parse(line));
      } catch {}
    }
  });
}
const exited = new Promise((done) => child.once('exit', done));
let browser;
let archiveHandle;
const results = {
  directory,
  count,
  mediaBytes,
  expectedHash,
  processMemory,
  phases: [],
  started: new Date().toISOString(),
};
const stage = (name) =>
  console.log(JSON.stringify({ stage: name, time: new Date().toISOString() }));
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        timeout: 1000,
      });
      break;
    } catch {
      if (child.exitCode !== null) throw new Error(output);
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  assert(browser, output);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent('page'));
  const diagnostics = await context.newCDPSession(page);
  const workerSessions = new Set();
  results.workerMemory = [];
  diagnostics.on('Target.attachedToTarget', ({ sessionId, targetInfo }) => {
    if (targetInfo.type === 'worker') workerSessions.add(sessionId);
  });
  diagnostics.on('Target.detachedFromTarget', ({ sessionId }) =>
    workerSessions.delete(sessionId),
  );
  diagnostics.on('Target.receivedMessageFromTarget', ({ message }) => {
    const response = JSON.parse(message);
    if (response.result?.usedSize !== undefined)
      results.workerMemory.push({ time: Date.now(), ...response.result });
  });
  await diagnostics.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: false,
  });
  let diagnosticId = 0;
  const diagnosticTimer = setInterval(() => {
    for (const sessionId of workerSessions)
      void diagnostics
        .send('Target.sendMessageToTarget', {
          sessionId,
          message: JSON.stringify({
            id: ++diagnosticId,
            method: 'Runtime.getHeapUsage',
          }),
        })
        .catch(() => {});
  }, 2000);
  diagnosticTimer.unref();
  diagnostics.on('Disconnected', () => clearInterval(diagnosticTimer));
  await page.getByRole('button', { name: /add your first game/i }).waitFor();
  await page.evaluate(() => window.electronAPI.setAutoCheck(false));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const setFile = async (path) => {
    const { root: document } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: document.nodeId,
      selector: '#backup-probe-file',
    });
    await cdp.send('DOM.setFileInputFiles', { nodeId, files: [path] });
  };
  await page.exposeBinding('writeBackupProbe', async (_source, encoded) => {
    const chunk = Buffer.from(encoded, 'base64');
    let offset = 0;
    while (offset < chunk.length) {
      const { bytesWritten } = await archiveHandle.write(
        chunk,
        offset,
        chunk.length - offset,
      );
      assert(bytesWritten > 0);
      offset += bytesWritten;
    }
  });
  await page.exposeBinding('reportBackupProbe', (_source, value) => {
    results.phases.push(value);
    if (value.phase !== results.lastPhase) {
      results.lastPhase = value.phase;
      stage(value.phase);
    }
  });
  await page.evaluate((code) => {
    const url = URL.createObjectURL(
      new Blob([code], { type: 'text/javascript' }),
    );
    window.backupProbe = {
      ticks: 0,
      maxHeap: 0,
      maxChunk: 0,
      bytes: 0,
      lastPhase: '',
      ended: false,
    };
    setInterval(() => {
      window.backupProbe.ticks++;
      window.backupProbe.maxHeap = Math.max(
        window.backupProbe.maxHeap,
        performance.memory?.usedJSHeapSize ?? 0,
      );
    }, 50);
    window.runBackupProbe = (request) =>
      new Promise((resolve, reject) => {
        const worker = new Worker(url);
        worker.onerror = (event) => {
          worker.terminate();
          reject(new Error(event.message));
        };
        worker.onmessage = async ({ data }) => {
          try {
            if (data.type === 'chunk') {
              window.backupProbe.maxChunk = Math.max(
                window.backupProbe.maxChunk,
                data.data.buffer.byteLength,
              );
              window.backupProbe.bytes += data.data.byteLength;
              let binary = '';
              for (let offset = 0; offset < data.data.length; offset += 32768)
                binary += String.fromCharCode(
                  ...data.data.subarray(offset, offset + 32768),
                );
              await window.writeBackupProbe(btoa(binary));
              worker.postMessage({ type: 'ack', sequence: data.sequence });
            } else if (data.type === 'progress') {
              const progress = data.progress;
              if (
                progress.phase !== window.backupProbe.lastPhase ||
                progress.current % 1000 === 0
              ) {
                window.backupProbe.lastPhase = progress.phase;
                await window.reportBackupProbe({
                  ...progress,
                  time: Date.now(),
                  ticks: window.backupProbe.ticks,
                  heap: performance.memory?.usedJSHeapSize,
                });
              }
            } else if (data.type === 'error') {
              worker.terminate();
              reject(new Error(data.message));
            } else if (data.type === 'done') {
              worker.terminate();
              window.backupProbe.ended = true;
              resolve(data);
            }
          } catch (error) {
            worker.terminate();
            reject(error);
          }
        };
        worker.postMessage(request);
      });
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'backup-probe-file';
    input.hidden = true;
    document.body.appendChild(input);
  }, workerCode);
  await setFile(fixture);
  stage('seed');
  const seedStart = Date.now();
  await page.evaluate(
    async ({ count }) => {
      const file = document.querySelector('#backup-probe-file').files[0];
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('FightingGameComboTracker');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const complete = (transaction) =>
        new Promise((resolve, reject) => {
          transaction.oncomplete = resolve;
          transaction.onabort = () => reject(transaction.error);
        });
      let transaction = db.transaction(
        ['games', 'characters', 'combos', 'demoVideos', 'mediaPayloads'],
        'readwrite',
      );
      transaction.objectStore('games').put({
        id: 'g',
        name: 'ZIP64 prototype',
        notationProfile: 'standard',
        buttonLayout: ['A'],
        createdAt: 1,
        updatedAt: 1,
      });
      transaction.objectStore('characters').put({
        id: 'c',
        gameId: 'g',
        name: 'Prototype character',
        createdAt: 1,
        updatedAt: 1,
      });
      transaction
        .objectStore('mediaPayloads')
        .put({ id: 'large-payload', data: file });
      transaction.objectStore('demoVideos').put({
        id: 'large-video',
        fileName: file.name,
        mimeType: file.type,
        payloadId: 'large-payload',
        size: file.size,
      });
      transaction.objectStore('combos').put({
        id: 'large-combo',
        characterId: 'c',
        name: 'Large media',
        notation: 'A',
        parsedNotation: [],
        tags: [],
        demoUrl: 'local:large-video',
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      await complete(transaction);
      for (let start = 0; start < count; start += 128) {
        transaction = db.transaction(
          ['combos', 'demoVideos', 'mediaPayloads'],
          'readwrite',
        );
        for (let index = start; index < Math.min(start + 128, count); index++) {
          const id = `video-${index}`;
          const payloadId = `payload-${index}`;
          const data = new Blob([new Uint8Array([index % 256, 42])], {
            type: 'video/mp4',
          });
          transaction.objectStore('mediaPayloads').put({ id: payloadId, data });
          transaction.objectStore('demoVideos').put({
            id,
            fileName: `${index}.mp4`,
            mimeType: 'video/mp4',
            payloadId,
            size: data.size,
          });
          transaction.objectStore('combos').put({
            id: `combo-${index}`,
            characterId: 'c',
            name: `Combo ${index}`,
            notation: 'A',
            parsedNotation: [],
            tags: [],
            demoUrl: `local:${id}`,
            sortOrder: index + 1,
            createdAt: 1,
            updatedAt: 1,
          });
        }
        await complete(transaction);
      }
      db.close();
    },
    { count },
  );
  results.seedMs = Date.now() - seedStart;
  results.storageBefore = await page.evaluate(() =>
    navigator.storage.estimate(),
  );
  stage('export');
  const exportStart = Date.now();
  if (!process.env.BACKUP_EXISTING_ARCHIVE) {
    archiveHandle = await open(archivePath, 'wx');
    await page.evaluate(() =>
      window.runBackupProbe({
        type: 'start',
        direction: 'export',
        format: 'zip',
      }),
    );
    await archiveHandle.sync();
    await archiveHandle.close();
    archiveHandle = undefined;
    results.exportMs = Date.now() - exportStart;
    results.archiveBytes = (await stat(archivePath)).size;
    assert(results.archiveBytes > mediaBytes);
    results.exportProbe = await page.evaluate(() => ({
      ...window.backupProbe,
    }));
    assert(results.exportProbe.maxChunk <= 256 * 1024);
    results.performanceAfterExport = await cdp.send('Performance.getMetrics');
  }
  await setFile(archivePath);
  stage('import');
  const importStart = Date.now();
  await page.evaluate(() =>
    window.runBackupProbe({
      type: 'start',
      direction: 'import',
      format: 'zip',
      data: document.querySelector('#backup-probe-file').files[0],
      includeVideos: true,
      includeSettings: true,
    }),
  );
  results.importMs = Date.now() - importStart;
  results.storageAfter = await page.evaluate(() =>
    navigator.storage.estimate(),
  );
  results.importProbe = await page.evaluate(() => ({ ...window.backupProbe }));
  stage('verify');
  const restoredPath = join(directory, 'restored-video.mp4');
  archiveHandle = await open(restoredPath, 'wx');
  const restored = await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open('FightingGameComboTracker');
      request.onsuccess = () => resolve(request.result);
    });
    const get = (table, id) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(table).objectStore(table).get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const count = (table) =>
      new Promise((resolve) => {
        const request = db.transaction(table).objectStore(table).count();
        request.onsuccess = () => resolve(request.result);
      });
    const video = await get('demoVideos', 'large-video');
    const payload = await get('mediaPayloads', video.payloadId);
    for (let offset = 0; offset < payload.data.size; offset += 256 * 1024) {
      const bytes = new Uint8Array(
        await payload.data.slice(offset, offset + 256 * 1024).arrayBuffer(),
      );
      let binary = '';
      for (let cursor = 0; cursor < bytes.length; cursor += 32768)
        binary += String.fromCharCode(
          ...bytes.subarray(cursor, cursor + 32768),
        );
      await window.writeBackupProbe(btoa(binary));
    }
    const sample = await get('demoVideos', 'video-999');
    const small = await get('mediaPayloads', sample.payloadId);
    const result = {
      videos: await count('demoVideos'),
      combos: await count('combos'),
      sessions: await count('backupSessions'),
      staged: await count('backupRecords'),
      payloads: await count('mediaPayloads'),
      sample: Array.from(new Uint8Array(await small.data.arrayBuffer())),
    };
    db.close();
    return result;
  });
  await archiveHandle.close();
  archiveHandle = undefined;
  results.restoredHash = await hashFile(restoredPath);
  assert.equal(results.restoredHash, expectedHash);
  assert.equal(restored.videos, count + 1);
  assert.equal(restored.combos, count + 1);
  assert.equal(restored.payloads, count + 1);
  assert.equal(restored.sessions, 0);
  assert.equal(restored.staged, 0);
  assert.deepEqual(restored.sample, [999 % 256, 42]);
  results.restored = restored;
  results.finished = new Date().toISOString();
  await writeFile(
    join(directory, 'results.json'),
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify({
      success: true,
      directory,
      archiveBytes: results.archiveBytes,
      exportMs: results.exportMs,
      importMs: results.importMs,
      probe: results.importProbe,
    }),
  );
} finally {
  await archiveHandle?.close().catch(() => {});
  await browser?.close().catch(() => {});
  child.kill();
  memoryProbe?.kill();
  await Promise.race([exited, new Promise((done) => setTimeout(done, 5000))]);
  // Keep this isolated fixture/profile for cross-tool ZIP64 checks and recovery inspection.
  await writeFile(
    join(directory, 'results.json'),
    JSON.stringify(results, null, 2),
  );
}
