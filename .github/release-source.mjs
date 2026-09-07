import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha = process.env.RELEASE_SHA || process.env.GITHUB_SHA;
const repository = process.env.GITHUB_REPOSITORY;
const output = (value) => appendFileSync(process.env.GITHUB_OUTPUT, `${value}\n`);
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const tag = `v${version}`;

// Stable production releases use the existing latest*.yml updater channel.
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error('Production releases require a stable X.Y.Z version.');
}

const prs = JSON.parse(execFileSync('gh', [
  'api', `repos/${repository}/commits/${sha}/pulls`, '--paginate', '--slurp',
], { encoding: 'utf8' })).flat();
const pr = prs.find((item) => item.merged_at && item.merge_commit_sha === sha &&
  item.base.ref === 'main' && item.head.ref === 'dev' &&
  item.head.repo?.full_name === repository);
if (!pr) throw new Error('main must be updated through a merged dev -> main PR.');

const parents = git('rev-list', '--parents', '-n', '1', sha).split(' ');
if (parents.length !== 2) throw new Error('Release PRs must use squash merge.');
const previousVersion = JSON.parse(git('show', `${sha}^:package.json`)).version;
const tags = git('tag', '--list', tag).split('\n');
if (previousVersion === version || !tags.includes(tag)) {
  console.log(`No new release tag for ${tag}; skipping release.`);
  output('ready=false');
  process.exit(0);
}

const tagSha = git('rev-parse', `${tag}^{commit}`);
if (tagSha !== pr.head.sha) throw new Error(`${tag} must point to the final PR head commit.`);
if (git('rev-parse', `${tag}^{tree}`) !== git('rev-parse', `${sha}^{tree}`)) {
  throw new Error('Tagged dev source differs from the squash-merged main source.');
}
execFileSync(process.execPath, ['.github/check-package-version.mjs', `--tag=${tag}`], { stdio: 'inherit' });
output(`tag=${tag}`);
output(`sha=${sha}`);
output('ready=true');
