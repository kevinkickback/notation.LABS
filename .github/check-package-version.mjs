import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

const versions = new Map([
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json root package", packageLock.packages?.[""]?.version],
]);
const expectedVersion = packageJson.version;
const mismatches = [...versions].filter(([, version]) => version !== expectedVersion);

const tagArgument = process.argv.find((argument) => argument.startsWith("--tag="));
const tag = tagArgument?.slice("--tag=".length);
if (tag && tag !== `v${expectedVersion}`) {
  mismatches.push(["release tag", tag]);
}

if (mismatches.length > 0) {
  const details = mismatches.map(([source, version]) => `${source}: ${version ?? "missing"}`).join("\n");
  throw new Error(`Version metadata does not match ${expectedVersion}:\n${details}`);
}

console.log(`Version metadata is synchronized at ${expectedVersion}${tag ? ` (${tag})` : ""}.`);
