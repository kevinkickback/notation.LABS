import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const branding = new URL('src/assets/branding/', root);
const buildDirectory = new URL('build/', root);
const sizes = [
  16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 120, 128, 144, 160, 192,
  256, 1024,
];
await mkdir(buildDirectory, { recursive: true });

function sourceFor(size) {
  if ([16, 20, 24, 48].includes(size)) return `app-mark-${size}.svg`;
  if (size === 96 || size === 192) return 'app-mark-48.svg';
  return 'app-mark.svg';
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
  const frames = [];
  for (const size of sizes) {
    const svg = await readFile(new URL(sourceFor(size), branding), 'utf8');
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
    if (size <= 256) frames.push({ size, png });
    if (size === 1024)
      await writeFile(new URL('icon.png', buildDirectory), png);
  }
  const ico = iconFile(frames);
  await writeFile(new URL('icon.ico', buildDirectory), ico);
} finally {
  await browser.close();
}
console.log('Built build/icon.ico and build/icon.png');
