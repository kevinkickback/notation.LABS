import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const branding = new URL('src/assets/branding/', root);
const exportsDirectory = new URL('exports/', branding);
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
await mkdir(exportsDirectory, { recursive: true });

function sourceFor(variant, size) {
  if (variant === 'n-flask')
    return size === 16
      ? 'app-mark-16.svg'
      : size === 24
        ? 'app-mark-24.svg'
        : 'app-mark.svg';
  return size === 16 ? 'flask-mark-16.svg' : 'flask-mark.svg';
}

function iconFile(frames) {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  for (const [index, { size, png }] of frames.entries()) {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  }
  return Buffer.concat([header, ...frames.map((frame) => frame.png)]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const variant of ['n-flask', 'flask']) {
    const frames = [];
    for (const size of sizes) {
      const svg = await readFile(
        new URL(sourceFor(variant, size), branding),
        'utf8',
      );
      const data = await page.evaluate(
        async ({ svg, size }) => {
          const image = new Image();
          image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas is unavailable');
          context.drawImage(image, 0, 0, size, size);
          return canvas.toDataURL('image/png').split(',')[1];
        },
        { svg, size },
      );
      const png = Buffer.from(data, 'base64');
      await writeFile(new URL(`${variant}-${size}.png`, exportsDirectory), png);
      if (size <= 256) frames.push({ size, png });
      if (variant === 'n-flask' && size === 512)
        await writeFile(new URL('build/icon.png', root), png);
    }
    const ico = iconFile(frames);
    await writeFile(new URL(`${variant}.ico`, exportsDirectory), ico);
    if (variant === 'n-flask')
      await writeFile(new URL('build/icon.ico', root), ico);
  }
} finally {
  await browser.close();
}
console.log(`Built both icon sets in ${fileURLToPath(exportsDirectory)}`);
