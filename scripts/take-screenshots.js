import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOCS = join(__dirname, '..', 'docs', 'images');
const BASE = 'http://localhost:5173';
const W = 1280;
const H = 800;

async function shot(page, name) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(DOCS, name), fullPage: false });
    console.log(`✓ ${name}`);
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: W, height: H });

    // ── 1. Game Library ────────────────────────────────────────────────────
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await shot(page, 'home.png');

    // ── 2. Character Select  (UNDER NIGHT IN-BIRTH II Sys:Celes) ──────────
    // Find the card whose heading contains "UNDER NIGHT"
    const gameCard = page.locator('h3').filter({ hasText: /UNDER NIGHT/i }).first();
    await gameCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await shot(page, 'characters.png');

    // ── 3. Combo View  (Merkava) ──────────────────────────────────────────
    const charCard = page.locator('*').filter({ hasText: /^Merkava$/ }).first();
    await charCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await shot(page, 'text.png');

    // ── 4. Add Combo ──────────────────────────────────────────────────────
    // Look for an "Add Combo" or "+" button on the combo view page
    const addBtn = page
        .getByRole('button', { name: /add combo|add your first combo/i })
        .first();
    await addBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'add.png');
    // Close the dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ── 5. Demo Video – open a combo that has a video attached ────────────
    //    Look for any combo row that has a video indicator/button and click it
    //    to open the video section, then screenshot.
    //    (Alternatively, open the add/edit dialog and scroll to the video field)
    // Try clicking a combo that has a video icon
    const videoBtn = page.locator('button[aria-label*="video" i], button[title*="video" i]').first();
    const videoBtnCount = await videoBtn.count();
    if (videoBtnCount > 0) {
        await videoBtn.click();
        await page.waitForTimeout(500);
        await shot(page, 'video.png');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
    } else {
        // Fallback: open the first combo's edit dialog and scroll to the video field
        const editBtn = page.locator('button[aria-label*="edit" i]').first();
        const editCount = await editBtn.count();
        if (editCount > 0) {
            await editBtn.click();
            await page.waitForTimeout(500);
            // Scroll to bottom of dialog to reveal video field
            const dialog = page.locator('[role="dialog"]');
            await dialog.evaluate((el) => (el.scrollTop = el.scrollHeight));
            await page.waitForTimeout(400);
            await shot(page, 'video.png');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        } else {
            console.log('⚠ video button not found, skipping video.png');
        }
    }

    // ── 6. Combo Notation Guide ───────────────────────────────────────────
    // Navigate back to home first so header is always visible
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    const guideBtn = page.getByRole('button', { name: /notation guide/i });
    await guideBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'guide.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ── 7. Export ─────────────────────────────────────────────────────────
    const exportBtn = page.getByRole('button', { name: /export data/i });
    await exportBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'export.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ── 8. Settings ───────────────────────────────────────────────────────
    const settingsBtn = page.locator('header button').last();
    await settingsBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'settings.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await browser.close();
    console.log('\nAll screenshots saved to docs/images/');
})();
