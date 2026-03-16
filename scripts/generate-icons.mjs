/**
 * Generates all required Electron build assets:
 * - build/icon.png (512x512 app icon)
 * - build/icon.ico (Windows multi-size icon)
 * - build/installerSidebar.bmp placeholder (164x314 for NSIS)
 * 
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');
mkdirSync(buildDir, { recursive: true });

// App icon SVG — a stylized "nL" monogram with a quarter-circle-forward motion arrow
// Dark background with vibrant accent, modern and clean
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e94560"/>
      <stop offset="100%" stop-color="#ff6b6b"/>
    </linearGradient>
    <linearGradient id="text" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e0e0e0"/>
    </linearGradient>
  </defs>
  
  <!-- Rounded square background -->
  <rect x="16" y="16" width="480" height="480" rx="96" ry="96" fill="url(#bg)"/>
  
  <!-- Subtle border -->
  <rect x="16" y="16" width="480" height="480" rx="96" ry="96" fill="none" stroke="#e94560" stroke-width="3" opacity="0.4"/>
  
  <!-- Quarter circle forward motion arrow (bottom left area) -->
  <g opacity="0.2" transform="translate(60, 280)">
    <path d="M 0 100 A 100 100 0 0 1 100 0" fill="none" stroke="#e94560" stroke-width="16" stroke-linecap="round"/>
    <polygon points="95,-15 115,0 95,15" fill="#e94560"/>
  </g>
  
  <!-- Main text: "n" stylized -->
  <text x="130" y="340" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="260" fill="url(#text)" letter-spacing="-8">n</text>
  
  <!-- Accent dot / period -->
  <circle cx="310" cy="325" r="22" fill="url(#accent)"/>
  
  <!-- "L" in accent color -->
  <text x="325" y="330" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="200" fill="url(#accent)" letter-spacing="-5">L</text>
  
  <!-- Numpad notation hint: small "236" at bottom -->
  <text x="256" y="440" font-family="monospace" font-weight="700" font-size="40" fill="#e94560" text-anchor="middle" opacity="0.6">236</text>
</svg>
`;

// Generate icon at multiple sizes
async function generateIcons() {
    console.log('Generating app icons...');

    const svgBuffer = Buffer.from(iconSvg);

    // 512x512 PNG (main icon for electron-builder)
    await sharp(svgBuffer)
        .resize(512, 512)
        .png()
        .toFile(join(buildDir, 'icon.png'));
    console.log('  ✓ build/icon.png (512x512)');

    // Generate PNGs at standard .ico sizes
    const icoSizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = await Promise.all(
        icoSizes.map(size =>
            sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toBuffer()
        )
    );

    // Convert to .ico
    const icoBuffer = await pngToIco(pngBuffers);
    writeFileSync(join(buildDir, 'icon.ico'), icoBuffer);
    console.log('  ✓ build/icon.ico (16,24,32,48,64,128,256)');

    // NSIS installer sidebar image (164x314) - dark themed
    const sidebarSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="164" height="314">
    <defs>
      <linearGradient id="sbg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1a1a2e"/>
        <stop offset="100%" stop-color="#16213e"/>
      </linearGradient>
    </defs>
    <rect width="164" height="314" fill="url(#sbg)"/>
    <!-- Subtle motion arrows pattern -->
    <g opacity="0.08">
      <path d="M 20 280 A 40 40 0 0 1 60 240" fill="none" stroke="#e94560" stroke-width="4"/>
      <path d="M 80 260 A 30 30 0 0 1 110 230" fill="none" stroke="#e94560" stroke-width="3"/>
      <path d="M 40 220 A 25 25 0 0 1 65 195" fill="none" stroke="#e94560" stroke-width="3"/>
    </g>
    <!-- App name vertically -->
    <text x="82" y="100" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle" opacity="0.9">n.L</text>
    <text x="82" y="140" font-family="monospace" font-weight="400" font-size="11" fill="#e94560" text-anchor="middle" opacity="0.7">notation</text>
    <text x="82" y="156" font-family="monospace" font-weight="400" font-size="11" fill="#e94560" text-anchor="middle" opacity="0.7">LABS</text>
  </svg>`;

    await sharp(Buffer.from(sidebarSvg))
        .resize(164, 314)
        .png()
        .toFile(join(buildDir, 'installerSidebar.png'));
    console.log('  ✓ build/installerSidebar.png (164x314)');

    // NSIS installer header image (150x57) - dark themed  
    const headerSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="150" height="57">
    <defs>
      <linearGradient id="hbg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1a1a2e"/>
        <stop offset="100%" stop-color="#16213e"/>
      </linearGradient>
    </defs>
    <rect width="150" height="57" fill="url(#hbg)"/>
    <text x="75" y="34" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="18" fill="#ffffff" text-anchor="middle">n<tspan fill="#e94560">.L</tspan></text>
    <text x="75" y="49" font-family="monospace" font-size="8" fill="#e94560" text-anchor="middle" opacity="0.7">notation.LABS</text>
  </svg>`;

    await sharp(Buffer.from(headerSvg))
        .resize(150, 57)
        .png()
        .toFile(join(buildDir, 'installerHeader.png'));
    console.log('  ✓ build/installerHeader.png (150x57)');

    // Uninstaller header/sidebar (same as installer)
    await sharp(Buffer.from(headerSvg))
        .resize(150, 57)
        .png()
        .toFile(join(buildDir, 'uninstallerHeader.png'));
    console.log('  ✓ build/uninstallerHeader.png (150x57)');

    await sharp(Buffer.from(sidebarSvg))
        .resize(164, 314)
        .png()
        .toFile(join(buildDir, 'uninstallerSidebar.png'));
    console.log('  ✓ build/uninstallerSidebar.png (164x314)');

    // Splash screen image (480x360) - dark themed with branding
    const splashSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
    <defs>
      <linearGradient id="spbg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1a1a2e"/>
        <stop offset="100%" stop-color="#16213e"/>
      </linearGradient>
      <linearGradient id="spacc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e94560"/>
        <stop offset="100%" stop-color="#ff6b6b"/>
      </linearGradient>
    </defs>
    <rect width="480" height="360" fill="url(#spbg)"/>
    <rect width="480" height="360" fill="none" stroke="#e94560" stroke-width="2" opacity="0.2"/>
    <g opacity="0.05">
      <path d="M 50 280 A 80 80 0 0 1 130 200" fill="none" stroke="#e94560" stroke-width="8" stroke-linecap="round"/>
      <path d="M 350 100 A 60 60 0 0 1 410 40" fill="none" stroke="#e94560" stroke-width="6" stroke-linecap="round"/>
      <path d="M 380 300 A 40 40 0 0 1 420 260" fill="none" stroke="#e94560" stroke-width="5" stroke-linecap="round"/>
    </g>
    <text x="240" y="165" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="80" fill="#ffffff" text-anchor="middle">n<tspan fill="url(#spacc)">.L</tspan></text>
    <text x="240" y="205" font-family="monospace" font-weight="600" font-size="16" fill="#e94560" text-anchor="middle" letter-spacing="6" opacity="0.8">notation.LABS</text>
    <text x="240" y="300" font-family="monospace" font-size="13" fill="#ffffff" text-anchor="middle" opacity="0.4">Loading...</text>
  </svg>`;

    await sharp(Buffer.from(splashSvg))
        .resize(480, 360)
        .png()
        .toFile(join(buildDir, 'splash.png'));
    console.log('  ✓ build/splash.png (480x360)');

    console.log('\nAll icons generated successfully!');
}

generateIcons().catch(err => {
    console.error('Failed to generate icons:', err);
    process.exit(1);
});
