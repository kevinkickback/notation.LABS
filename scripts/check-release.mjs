import { readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

let notesFile;
let previousVersion;
let sourceRoot;
const arguments_ = process.argv.slice(2);
for (let index = 0; index < arguments_.length; index += 1) {
  const argument = arguments_[index];
  const value = arguments_[index + 1];
  if (
    argument === '--notes-file' ||
    argument === '--previous-version' ||
    argument === '--source-root'
  ) {
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value.`);
    }
    if (argument === '--notes-file') notesFile = value;
    else if (argument === '--previous-version') previousVersion = value;
    else sourceRoot = value;
    index += 1;
  } else {
    throw new Error(`Unknown argument: ${argument}`);
  }
}

const root = sourceRoot
  ? pathToFileURL(`${resolve(sourceRoot)}${sep}`)
  : new URL('../', import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, root), 'utf8'));

const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const version = packageJson.version;
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (typeof version !== 'string' || !stableVersionPattern.test(version)) {
  throw new Error(
    'Releases require a stable X.Y.Z package version (no prerelease or build suffix).',
  );
}

const metadataVersions = new Map([
  ['package-lock.json', packageLock.version],
  ['package-lock.json root package', packageLock.packages?.['']?.version],
]);
const mismatches = [...metadataVersions].filter(
  ([, candidate]) => candidate !== version,
);
if (mismatches.length > 0) {
  const details = mismatches
    .map(([source, candidate]) => `${source}: ${candidate ?? 'missing'}`)
    .join('\n');
  throw new Error(
    `Version metadata does not match package.json (${version}):\n${details}`,
  );
}

if (previousVersion !== undefined) {
  if (!stableVersionPattern.test(previousVersion)) {
    throw new Error(
      `Previous package version is not stable X.Y.Z: ${previousVersion}`,
    );
  }
  const current = version.split('.').map(Number);
  const previous = previousVersion.split('.').map(Number);
  const difference = current.findIndex(
    (part, index) => part !== previous[index],
  );
  if (difference === -1 || current[difference] < previous[difference]) {
    throw new Error(
      `Release version must increase (${previousVersion} -> ${version}).`,
    );
  }
}

const changelogPath = `changelogs/v${version}.md`;
let notes;
try {
  notes = (await readFile(new URL(changelogPath, root), 'utf8')).trim();
} catch {
  throw new Error(`Missing release changelog: ${changelogPath}`);
}
if (!notes) {
  throw new Error(`Release changelog is empty: ${changelogPath}`);
}

if (notesFile !== undefined) await writeFile(notesFile, `${notes}\n`);

console.log(`Release metadata and notes validated for v${version}.`);
