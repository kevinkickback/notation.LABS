import { readFile, writeFile } from 'node:fs/promises';

let notesFile;
let publishedTagsFile;
const arguments_ = process.argv.slice(2);
for (let index = 0; index < arguments_.length; index += 1) {
  const argument = arguments_[index];
  const value = arguments_[index + 1];
  if (argument === '--notes-file' || argument === '--published-tags-file') {
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value.`);
    }
    if (argument === '--notes-file') notesFile = value;
    else publishedTagsFile = value;
    index += 1;
  } else {
    throw new Error(`Unknown argument: ${argument}`);
  }
}

const root = new URL('../', import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, root), 'utf8'));

const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const version = packageJson.version;
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const compareVersions = (left, right) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
};

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

if (publishedTagsFile !== undefined) {
  const publishedVersions = (
    await readFile(new URL(publishedTagsFile, root), 'utf8')
  )
    .split(/\r?\n/)
    .map((tag) => tag.trim().replace(/^v/, ''))
    .filter((tag) => stableVersionPattern.test(tag));
  const latestPublished = publishedVersions.reduce(
    (latest, candidate) =>
      latest === undefined || compareVersions(candidate, latest) > 0
        ? candidate
        : latest,
    undefined,
  );
  if (
    latestPublished !== undefined &&
    compareVersions(version, latestPublished) <= 0
  ) {
    throw new Error(
      `Release version ${version} must be greater than the latest published version ${latestPublished}.`,
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
