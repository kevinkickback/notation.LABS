import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const assetPath = (path: string) => resolve(process.cwd(), path);
const exported = (variant: string, size: number) =>
  readFile(assetPath(`src/assets/branding/exports/${variant}-${size}.png`));

describe('application branding assets', () => {
  it('preserves the detailed splash independently of the compact app icon', async () => {
    const splash = await readFile(assetPath('src/assets/branding/splash-logo.png'));
    expect(createHash('sha256').update(splash).digest('hex')).toBe('89d72f746d9775507ca0b809334b7b586e6cc09d77dc180c7aadc4051b200162');
    const appIcon = await readFile(assetPath('build/icon.png'));
    expect(appIcon.equals(splash)).toBe(false);
    expect(appIcon.readUInt32BE(16)).toBe(512);
    expect(appIcon.readUInt32BE(20)).toBe(512);
  });

  it('packages native, correctly sized PNG frames for Windows and exports both directions', async () => {
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const appIcon = await readFile(assetPath('build/icon.png'));
    const variant = appIcon.equals(await exported('n-flask', 512)) ? 'n-flask' : 'flask';
    expect(appIcon.equals(await exported(variant, 512))).toBe(true);
    const ico = await readFile(assetPath('build/icon.ico'));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(sizes.length);
    let expectedOffset = 6 + 16 * sizes.length;
    for (const [index, size] of sizes.entries()) {
      const entry = 6 + 16 * index;
      expect(ico[entry] || 256).toBe(size);
      expect(ico[entry + 1] || 256).toBe(size);
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(offset).toBe(expectedOffset);
      const frame = ico.subarray(offset, offset + length);
      expect(frame.equals(await exported(variant, size))).toBe(true);
      expectedOffset += length;
      for (const direction of ['n-flask', 'flask']) {
        const png = await exported(direction, size);
        expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(png.readUInt32BE(16)).toBe(size);
        expect(png.readUInt32BE(20)).toBe(size);
      }
    }
    expect(expectedOffset).toBe(ico.length);
  });
});
