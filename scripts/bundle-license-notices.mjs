import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function bundledPackageDirectory(id) {
  const normalized = id.replaceAll('\\', '/').replaceAll('\0', '');
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return null;
  const parts = normalized.slice(index + marker.length).split('/');
  const name = parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/');
  return `${normalized.slice(0, index + marker.length)}${name}`;
}

/** Retain verbatim dependency licenses when bundling replaces packaged node_modules. */
export function bundleLicenseNotices() {
  return {
    name: 'bundle-license-notices',
    apply: 'build',
    async generateBundle() {
      const directories = new Set(
        [...this.getModuleIds()].map(bundledPackageDirectory).filter(Boolean),
      );
      const notices = [];
      for (const directory of [...directories].sort()) {
        const metadata = JSON.parse(
          await readFile(join(directory, 'package.json'), 'utf8'),
        );
        const files = (
          await readdir(directory, { withFileTypes: true })
        ).filter(
          (entry) =>
            entry.isFile() &&
            /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(entry.name),
        );
        const text = await Promise.all(
          files
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(
              async (file) =>
                `${file.name}\n${await readFile(join(directory, file.name), 'utf8')}`,
            ),
        );
        notices.push(
          `${metadata.name}@${metadata.version}\n${text.length ? text.join('\n\n') : JSON.stringify({ license: metadata.license, author: metadata.author, repository: metadata.repository }, null, 2)}`,
        );
      }
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD_PARTY_NOTICES.txt',
        source: notices.join(
          '\n\n----------------------------------------\n\n',
        ),
      });
    },
  };
}
