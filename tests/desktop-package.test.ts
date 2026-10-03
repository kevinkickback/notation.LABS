import { describe, expect, it } from 'vitest';
// @ts-expect-error Standalone Node build script; executed directly by build:desktop.
import { assertDesktopBundle, desktopMetadata } from '../scripts/stage-desktop-app.mjs';
// @ts-expect-error Standalone build plugin used by Vite.
import { bundledPackageDirectory } from '../scripts/bundle-license-notices.mjs';

function bundle(main = '', extra: Array<[string, string]> = []) {
  return new Map([['main.js', main], ['preload.mjs', 'const { contextBridge } = require("electron");'], ...extra]);
}

describe('desktop packaging closure', () => {
  it.each([
    ['/project/node_modules/react/index.js', '/project/node_modules/react'],
    ['C:\\project\\node_modules\\@radix-ui\\react-dialog\\dist\\index.js', 'C:/project/node_modules/@radix-ui/react-dialog'],
    ['\0/project/node_modules/electron-updater/node_modules/semver/index.js?commonjs-proxy', '/project/node_modules/electron-updater/node_modules/semver'],
    ['node:fs', null],
    ['/project/src/App.tsx', null],
  ])('locates notices for bundled module %s', (id, directory) => {
    expect(bundledPackageDirectory(id)).toBe(directory);
  });
  it('accepts Node and Electron modules plus generated chunks', () => {
    expect(() => assertDesktopBundle(bundle(`import { app } from 'electron'; import { readFile } from 'node:fs/promises'; import './chunk.js'; export { result } from './nested/result.js'; const stream = require('stream');`, [['chunk.js', 'export const value = 1;'], ['nested/result.js', 'export const result = 2;']]))).not.toThrow();
  });
  it.each([
    `import React from 'react';`,
    `import('electron-updater');`,
    `require('semver');`,
    `module.require('fs-extra');`,
    `export { value } from './missing.js';`,
    `import '../../outside.js';`,
  ])('rejects unresolved runtime modules: %s', main => {
    expect(() => assertDesktopBundle(bundle(main))).toThrow('is not bundled');
  });
  it.each([`require(moduleName);`, `import(moduleName);`, `module.require(name);`])('rejects dynamic module resolution: %s', main => {
    expect(() => assertDesktopBundle(bundle(main))).toThrow('dynamic runtime module loading');
  });
  it('checks imports in generated chunks and fails without the preload', () => {
    expect(() => assertDesktopBundle(bundle(`import './chunk.js'`, [['chunk.js', `import 'missing';`]]))).toThrow('runtime module missing');
    expect(() => assertDesktopBundle(new Map([['main.js', '']]))).toThrow('preload');
  });
  it('copies synchronized app metadata and omits build-time dependency declarations', () => {
    const metadata = { name: 'notation-labs', version: '1.9.0', type: 'module', main: 'dist-electron/main.js', license: 'GPL-3.0-or-later', description: 'App', homepage: 'https://example.com', author: { name: 'Author' }, private: true };
    expect(desktopMetadata({ ...metadata, dependencies: { react: '1', 'electron-updater': '1' }, devDependencies: { typescript: '1' }, scripts: { test: 'vitest' }, build: { files: [] } })).toEqual(metadata);
  });
});
