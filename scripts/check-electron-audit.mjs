import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Electron ships in the app although npm classifies it as a development dependency. */
export function assertElectronAudit(report) {
  if (
    report?.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== 'object' ||
    Array.isArray(report.vulnerabilities) ||
    report.error
  )
    throw new Error('npm did not return a valid dependency audit');
  if (report.vulnerabilities.electron)
    throw new Error(
      `The shipped Electron runtime has security advisories:\n${JSON.stringify(report.vulnerabilities.electron, null, 2)}`,
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (!process.env.npm_execpath)
    throw new Error('Run through npm run audit:electron');
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, 'audit', '--include=dev', '--json'],
    {
      cwd: new URL('../', import.meta.url),
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1)
    throw new Error('npm dependency audit could not complete');
  assertElectronAudit(JSON.parse(result.stdout));
  console.log(
    'Shipped Electron runtime has no reported advisories. Audit production dependencies separately.',
  );
}
