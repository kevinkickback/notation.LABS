import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, root), 'utf8'));

const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const version = packageJson.version;

if (
  typeof version !== 'string' ||
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
) {
  throw new Error('Releases require a stable X.Y.Z package version.');
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

const arguments_ = process.argv.slice(2);
const unknownArguments = arguments_.filter((argument, index) => {
  return (
    argument !== '--notes-file' && arguments_[index - 1] !== '--notes-file'
  );
});
if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument: ${unknownArguments[0]}`);
}

const notesFlag = arguments_.indexOf('--notes-file');
if (notesFlag !== -1) {
  const outputPath = arguments_[notesFlag + 1];
  if (!outputPath) throw new Error('--notes-file requires a path.');
  await writeFile(outputPath, `${notes}\n`);
}

console.log(`Release metadata and notes validated for v${version}.`);
