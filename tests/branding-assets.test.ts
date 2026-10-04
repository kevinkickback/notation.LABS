import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const assetPath = (path: string) => resolve(process.cwd(), path);

describe('application branding assets', () => {
  it('provides valid PNG assets for the splash and desktop icon', async () => {
    const splash = await readFile(assetPath('src/assets/branding/splash-logo.png'));
    expect(splash.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(splash.readUInt32BE(16)).toBe(512);
    expect(splash.readUInt32BE(20)).toBe(512);
    const appIcon = await readFile(assetPath('build/icon.png'));
    expect(appIcon.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(appIcon.readUInt32BE(16)).toBe(1024);
    expect(appIcon.readUInt32BE(20)).toBe(1024);
  });

  it('packages all native N+Flask Windows sizes in one icon', async () => {
    const sizes = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 120, 128, 144, 160, 192, 256];
    const ico = await readFile(assetPath('build/icon.ico'));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(sizes.length);
    let expectedOffset = 6 + 16 * sizes.length;
    for (const [index, size] of sizes.entries()) {
      const entry = 6 + 16 * index;
      expect(ico[entry] || 256).toBe(size);
      expect(ico[entry + 1] || 256).toBe(size);
      expect(ico.readUInt16LE(entry + 4)).toBe(1);
      expect(ico.readUInt16LE(entry + 6)).toBe(32);
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(offset).toBe(expectedOffset);
      const frame = ico.subarray(offset, offset + length);
      expect(length).toBeGreaterThan(24);
      expectedOffset += length;
      expect(frame.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(frame.readUInt32BE(16)).toBe(size);
      expect(frame.readUInt32BE(20)).toBe(size);
    }
    expect(expectedOffset).toBe(ico.length);
  });
});
