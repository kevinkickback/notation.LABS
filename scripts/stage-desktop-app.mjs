import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stageDirectory = resolve(projectRoot, '.tmp', 'desktop-app');
const builtins = new Set([
  'electron',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

/** Reject runtime modules that would otherwise be missing from the lean package. */
export function assertDesktopBundle(files) {
  if (!files.has('main.js') || !files.has('preload.mjs'))
    throw new Error(
      'Build the desktop main process and preload before staging',
    );
  for (const [name, source] of files) {
    if (!/\.(?:[cm]?js)$/.test(name)) continue;
    const syntax = ts.createSourceFile(
      name,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const checkModule = (node) => {
      if (!node || !ts.isStringLiteralLike(node))
        throw new Error(
          `${name}: dynamic runtime module loading cannot be packaged safely`,
        );
      const specifier = node.text;
      if (builtins.has(specifier)) return;
      if (
        specifier.startsWith('.') &&
        files.has(posix.normalize(posix.join(posix.dirname(name), specifier)))
      )
        return;
      throw new Error(
        `${name}: runtime module ${specifier} is not bundled; include it in the desktop build`,
      );
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) checkModule(node.moduleSpecifier);
      } else if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (
          callee.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === 'require') ||
          (ts.isPropertyAccessExpression(callee) &&
            callee.name.text === 'require')
        ) {
          checkModule(node.arguments[0]);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(syntax);
  }
}

async function readDesktopFiles(directory, prefix = '') {
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = posix.join(prefix, entry.name);
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const item of await readDesktopFiles(path, name)) files.set(...item);
    } else if (entry.isFile()) {
      files.set(name, await readFile(path, 'utf8'));
    } else
      throw new Error(
        `Desktop output cannot contain links or special files: ${name}`,
      );
  }
  return files;
}

export function desktopMetadata(metadata) {
  const fields = [
    'name',
    'private',
    'version',
    'description',
    'homepage',
    'author',
    'license',
    'type',
    'main',
  ];
  return Object.fromEntries(
    fields
      .filter((field) => metadata[field] !== undefined)
      .map((field) => [field, metadata[field]]),
  );
}

export async function stageDesktopApp() {
  assertDesktopBundle(
    await readDesktopFiles(join(projectRoot, 'dist-electron')),
  );
  const metadata = JSON.parse(
    await readFile(join(projectRoot, 'package.json'), 'utf8'),
  );
  // This fixed, resolved target is owned by the build; source and release output are never removed.
  if (stageDirectory !== join(projectRoot, '.tmp', 'desktop-app'))
    throw new Error('Invalid desktop staging directory');
  await rm(stageDirectory, { recursive: true, force: true });
  await mkdir(stageDirectory, { recursive: true });
  await Promise.all([
    cp(join(projectRoot, 'dist'), join(stageDirectory, 'dist'), {
      recursive: true,
    }),
    cp(join(projectRoot, 'LICENSE'), join(stageDirectory, 'LICENSE')),
    cp(
      join(projectRoot, 'dist-electron'),
      join(stageDirectory, 'dist-electron'),
      { recursive: true },
    ),
    writeFile(
      join(stageDirectory, 'package.json'),
      `${JSON.stringify(desktopMetadata(metadata), null, 2)}\n`,
    ),
  ]);
  console.log('Desktop app staged with bundled code and release metadata.');
}

// All app libraries are bundled. Returning false prevents the packager from falling back
// to the root dependency tree when this staged app intentionally has no node_modules.
export default async function beforeBuild({ appDir }) {
  if (resolve(appDir) !== stageDirectory)
    throw new Error('Package the generated desktop staging directory');
  assertDesktopBundle(await readDesktopFiles(join(appDir, 'dist-electron')));
  return false;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await stageDesktopApp();
