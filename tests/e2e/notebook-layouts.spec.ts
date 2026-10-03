import { expect, test, type Locator } from '@playwright/test';
import type { Page } from '@playwright/test';

async function readDockWidth(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return (await indexedDbStorage.settings.get()).notebookDockWidth;
  });
}

async function checkNoteEditPosition(surface: Locator) {
  const body = await surface.locator('.notebook-note-content').boundingBox();
  const edit = await surface.getByRole('button', { name: 'Edit note', exact: true }).boundingBox();
  if (!body || !edit) throw new Error('The note body or Edit button is missing');
  expect(edit.x + edit.width).toBeCloseTo(body.x + body.width - 14, 0);
  expect(edit.y).toBeCloseTo(body.y + 14, 0);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const gameId = await indexedDbStorage.games.add({ name: 'Street Fighter 6', buttonLayout: ['L', 'M', 'H'], notes: '## Practice session\n\nWarm up anti-airs before ranked.\n\n- Ten clean confirms\n- Review yesterday’s replays' });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Ryu', notes: '## Game plan\n\nControl mid-range with **fireballs** and punish unsafe approaches.\n\n### Practice reminders\n\n- Confirm crouching medium kick into Drive Rush\n- Keep an anti-air ready\n- Save meter for the corner\n\n### Matchup notes\n\nStay patient against zoners. Walk forward between projectiles and watch for jump-ins.', links: [
      { id: 'wiki', url: 'https://dustloop.com', label: 'Frame data and move reference' },
      { id: 'guide', url: 'https://example.com/guide', label: 'Matchup guide' },
    ] });
    await indexedDbStorage.combos.add({ characterId, name: 'Mid-screen confirm', notation: '2M > 5M > 236H', parsedNotation: [], tags: ['confirm'], description: 'Practice confirming before committing to the special.' });
    await indexedDbStorage.characters.add({ gameId, name: 'Empty notebook' });
  });
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(page.getByRole('button', { name: 'Notes & Resources', exact: true })).toBeVisible();
});

  test('Drawer supports notes and resource editing at every breakpoint', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
    const surface = page.getByRole('dialog', { name: 'Ryu Notebook' });
    await expect(surface).toBeVisible();
    await expect(surface.getByText('fireballs', { exact: true })).toBeVisible();
    await expect(surface.getByText('fireballs', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
    await expect(surface.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: 'Edit note', exact: true })).toBeVisible();
    await expect(surface.getByRole('heading', { name: 'Notes', exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('notebook-drawer.png') });
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 800, height: 600 }, { width: 375, height: 700 }, { width: 320, height: 480 }]) {
      await page.setViewportSize(viewport);
      expect(await surface.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        const box = await surface.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect(box?.y).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
        await surface.getByRole('tab', { name: 'Notes', exact: true }).click();
      await checkNoteEditPosition(surface);
      await surface.getByRole('button', { name: 'Edit note', exact: true }).click();
      await expect(surface.getByRole('button', { name: 'Save Note', exact: true })).toHaveText('Save');
      const note = surface.getByRole('textbox', { name: 'Note', exact: true });
      await note.fill(`**Practice** at ${viewport.width}px`);
      await surface.getByRole('tab', { name: 'Preview', exact: true }).click();
      await expect(surface.getByText('Practice', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
      await surface.getByRole('button', { name: 'Save Note', exact: true }).click();
      await expect(surface.getByText(`at ${viewport.width}px`, { exact: false })).toBeVisible();
      await surface.getByRole('tab', { name: /^Resources/ }).click();
      await surface.getByRole('button', { name: 'Add resource link', exact: true }).click();
      await surface.getByRole('textbox', { name: 'URL', exact: true }).fill(`example.com/${viewport.width}`);
      await surface.getByRole('textbox', { name: /Label/ }).fill(`Practice guide ${viewport.width}`);
      await surface.getByRole('button', { name: 'Add resource', exact: true }).click();
      await expect(surface.getByRole('link', { name: `Open Practice guide ${viewport.width} in a new tab`, exact: true })).toHaveAttribute('href', `https://example.com/${viewport.width}`);
      await surface.getByRole('button', { name: `Edit Practice guide ${viewport.width}`, exact: true }).click();
      await surface.getByRole('textbox', { name: /Label/ }).fill(`Updated guide ${viewport.width}`);
      await surface.getByRole('button', { name: 'Save resource', exact: true }).click();
      await expect(surface.getByRole('link', { name: `Open Updated guide ${viewport.width} in a new tab`, exact: true })).toBeVisible();
      await surface.getByRole('button', { name: `Remove Updated guide ${viewport.width}`, exact: true }).click();
      await expect(surface.getByRole('link', { name: `Open Updated guide ${viewport.width} in a new tab`, exact: true })).toHaveCount(0);
      await expect(surface.getByRole('link', { name: 'Open Matchup guide in a new tab', exact: true })).toBeVisible();
      await surface.getByRole('tab', { name: 'Notes', exact: true }).click();
      if (viewport.width === 375) await page.screenshot({ path: testInfo.outputPath('notebook-drawer-mobile.png') });
    }
    await page.reload();
    await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
    await page.locator('h3', { hasText: 'Ryu' }).click();
    const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('at 320px', { exact: false })).toBeVisible();
  });

test('shares the editor with game notes and exposes empty character notebooks before a combo exists', async ({ page }) => {
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Updated **game** plan');
  const drawer = page.getByRole('dialog', { name: 'Street Fighter 6 Notebook' });
  await expect(drawer.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Updated **game** plan');
  await drawer.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(drawer.getByText('game', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('h3', { hasText: 'Empty notebook' }).click();
  await expect(page.getByRole('button', { name: 'Notes & Resources', exact: true })).toHaveCount(0);
  const originalNote = page.getByRole('button', { name: 'Edit Note', exact: true });
  await expect(originalNote).toHaveCount(1);
  await originalNote.click();
  await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('');
  await page.getByRole('tab', { name: /^Resources/ }).click();
  await page.getByRole('button', { name: 'Add resource link', exact: true }).click();
  await page.getByRole('textbox', { name: 'URL', exact: true }).fill('https://example.com/practice');
  await page.getByRole('button', { name: 'Add resource', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open example.com in a new tab', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Notes', exact: true }).click();
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Start here');
  await page.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(page.getByText('Start here', { exact: true })).toBeVisible();
});

test('keeps the notebook button plain and uniform through content changes and hides unavailable docking', async ({ page }, testInfo) => {
  const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
  const indicator = toggle.locator('.notebook-content-indicator');
  const original = await toggle.boundingBox();
  if (!original) throw new Error('The notebook button is missing');
  await toggle.click();
  const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await drawer.getByRole('tab', { name: /^Resources/ }).click();
  await page.screenshot({ path: testInfo.outputPath('notebook-resources.png') });
  await drawer.getByRole('tab', { name: 'Notes', exact: true }).click();
  for (const width of [1440, 1100, 1099, 800, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(indicator).toHaveCount(0);
    await expect(toggle).toHaveText('Notes & Resources');
    await expect(toggle).toHaveAccessibleDescription('');
    const box = await toggle.boundingBox();
    expect(box?.width).toBeCloseTo(original.width, 0);
    expect(box?.height).toBeCloseTo(original.height, 0);
    if (width >= 1100) await expect(drawer.getByRole('button', { name: 'Dock', exact: true })).toBeEnabled();
    else {
      await expect(drawer.getByRole('button', { name: 'Dock', exact: true })).toHaveCount(0);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await drawer.getByRole('button', { name: 'Edit note', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'Note', exact: true }).fill('');
  await drawer.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(drawer.getByText('Nothing saved yet.', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: 'Add note', exact: true })).toHaveText('Add');
  await expect(indicator).toHaveCount(0);
  await drawer.getByRole('tab', { name: /^Resources/ }).click();
  await drawer.getByRole('button', { name: 'Remove Frame data and move reference', exact: true }).click();
  await drawer.getByRole('button', { name: 'Remove Matchup guide', exact: true }).click();
  await expect(drawer.getByRole('region', { name: 'Resources', exact: true }).getByText('Nothing saved yet.', { exact: true })).toBeVisible();
  await expect(indicator).toHaveCount(0);
  const empty = await toggle.boundingBox();
  expect(empty?.width).toBeCloseTo(original.width, 0);
  await drawer.getByRole('button', { name: 'Add resource link', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'URL', exact: true }).fill('example.com/reference');
  await drawer.getByRole('button', { name: 'Add resource', exact: true }).click();
  await expect(indicator).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Remove example.com', exact: true }).click();
  await expect(indicator).toHaveCount(0);
  await drawer.getByRole('tab', { name: 'Notes', exact: true }).click();
  await drawer.getByRole('button', { name: 'Add note', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'Note', exact: true }).fill('Practice anti-airs');
  await expect(indicator).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(indicator).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('notebook-plain-button.png') });
});

test('loads resource favicons with an offline fallback and keeps notebook actions out of overflow', async ({ page }) => {
  await page.route('https://www.google.com/s2/favicons?**', async route => {
    const domain = new URL(route.request().url()).searchParams.get('domain');
    if (domain === 'dustloop.com') await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBkcAAAAASUVORK5CYII=', 'base64') });
    else await route.abort();
  });
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Add Note', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Add Resource Link', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Edit Game Buttons', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  await page.getByRole('tab', { name: /^Resources/ }).click();
  const wiki = page.getByRole('link', { name: 'Open Frame data and move reference in a new tab', exact: true });
  await expect(wiki.locator('img')).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=dustloop.com&sz=32');
  await expect(wiki.locator('img')).toHaveJSProperty('naturalWidth', 1);
  const guide = page.getByRole('link', { name: 'Open Matchup guide in a new tab', exact: true });
  await expect(guide.locator('.notebook-resource-favicon svg')).toBeVisible();
  await expect(guide.locator('img')).toHaveCount(0);
  await expect(guide).toHaveAttribute('href', 'https://example.com/guide');
});

test('accepts resource hosts with ports while rejecting explicit non-HTTP schemes', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await drawer.getByRole('tab', { name: /^Resources/ }).click();
  await drawer.getByRole('button', { name: 'Add resource link', exact: true }).click();
  const url = drawer.getByRole('textbox', { name: 'URL', exact: true });
  await url.fill('ftp://example.com/guide');
  await drawer.getByRole('button', { name: 'Add resource', exact: true }).click();
  await expect(drawer.getByRole('alert')).toContainText('HTTP or HTTPS');
  for (const [host, label] of [['localhost:3000/guide', 'Local guide'], ['example.com:8080/guide', 'Port guide']]) {
    await url.fill(host);
    await drawer.getByRole('textbox', { name: /Label/ }).fill(label);
    await drawer.getByRole('button', { name: 'Add resource', exact: true }).click();
    await expect(drawer.getByRole('link', { name: `Open ${label} in a new tab`, exact: true })).toHaveAttribute('href', `https://${host}`);
    if (label === 'Local guide') await drawer.getByRole('button', { name: 'Add resource link', exact: true }).click();
  }
});

for (const kind of ['game', 'character'] as const) {
  test(`blocks the floating ${kind} editor while destination reads are pending`, async ({ page }) => {
    if (kind === 'game') await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: kind === 'game' ? 'Notes' : 'Notes & Resources', exact: true }).click();
    const drawer = page.locator('.notebook-drawer');
    await drawer.getByRole('button', { name: 'Edit note', exact: true }).click();
    const editor = drawer.locator('textarea');
    await editor.fill('Keep this draft unsaved during navigation');
    await page.evaluate(async () => {
      const path = '/src/lib/storage/indexedDbStorage.ts';
      const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
      let writes = 0;
      const ready = new Promise<void>(resolve => Object.assign(window, { finishNotebookNavigation: resolve }));
      Object.assign(window, { notebookEntityWrites: () => writes });
      const readCharacters = indexedDbStorage.characters.getByGame;
      const readCombos = indexedDbStorage.combos.getByCharacter;
      indexedDbStorage.characters.getByGame = id => readCharacters(id).then(async rows => { await ready; return rows; });
      indexedDbStorage.combos.getByCharacter = id => readCombos(id).then(async rows => { await ready; return rows; });
      const updateCharacter = indexedDbStorage.characters.update;
      const updateGame = indexedDbStorage.games.update;
      indexedDbStorage.characters.update = (...args) => { writes++; return updateCharacter(...args); };
      indexedDbStorage.games.update = (...args) => { writes++; return updateGame(...args); };
    });
    if (kind === 'game') await page.locator('h3', { hasText: 'Ryu' }).click();
    else await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    expect(await drawer.evaluate(element => Boolean(element.closest('main[inert]')))).toBe(true);
    await editor.evaluate(element => element.focus());
    await expect(editor).not.toBeFocused();
    const save = await drawer.locator('button[aria-label="Save Note"]').boundingBox();
    if (!save) throw new Error('The retained note editor is missing');
    await page.mouse.click(save.x + save.width / 2, save.y + save.height / 2);
    expect(await page.evaluate(() => (window as unknown as { notebookEntityWrites: () => number }).notebookEntityWrites())).toBe(0);
    await page.evaluate(() => (window as unknown as { finishNotebookNavigation: () => void }).finishNotebookNavigation());
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
    await expect(drawer).toHaveCount(0);
    await expect(page.locator('h3', { hasText: kind === 'game' ? 'Mid-screen confirm' : 'Ryu' })).toBeVisible();
  });
}

for (const notebookDocked of [false, true]) {
  test(`restores focus after note and resource edits and removal with docked=${notebookDocked}`, async ({ page }) => {
    await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
    if (notebookDocked) await page.getByRole('button', { name: 'Dock', exact: true }).click();
    const panel = page.getByRole(notebookDocked ? 'complementary' : 'dialog', { name: 'Ryu Notebook' });
    await panel.getByRole('button', { name: 'Edit note', exact: true }).click();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Edit note', exact: true })).toBeFocused();
    await panel.getByRole('button', { name: 'Edit note', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Note', exact: true }).fill('Updated practice plan');
    await panel.getByRole('button', { name: 'Save Note', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Edit note', exact: true })).toBeFocused();
    await panel.getByRole('tab', { name: /^Resources/ }).click();
    await panel.getByRole('button', { name: 'Add resource link', exact: true }).click();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Add resource link', exact: true })).toBeFocused();
    await panel.getByRole('button', { name: 'Add resource link', exact: true }).click();
    await panel.getByRole('textbox', { name: 'URL', exact: true }).fill('https://example.com/focus');
    await panel.getByRole('textbox', { name: /Label/ }).fill('Focus guide');
    await panel.getByRole('button', { name: 'Add resource', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Add resource link', exact: true })).toBeFocused();
    await panel.getByRole('button', { name: 'Edit Focus guide', exact: true }).click();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Edit Focus guide', exact: true })).toBeFocused();
    await panel.getByRole('button', { name: 'Edit Focus guide', exact: true }).click();
    await panel.getByRole('textbox', { name: /Label/ }).fill('Updated focus guide');
    await panel.getByRole('button', { name: 'Save resource', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Edit Updated focus guide', exact: true })).toBeFocused();
    await panel.getByRole('button', { name: 'Remove Updated focus guide', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Remove Updated focus guide', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Add resource link', exact: true })).toBeFocused();
  });

  test(`restores opener focus when saving an open preference fails with docked=${notebookDocked} and allows retry`, async ({ page }) => {
    await page.evaluate(async notebookDocked => {
      const path = '/src/lib/storage/indexedDbStorage.ts';
      const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
      await indexedDbStorage.settings.update({ notebookDocked });
    }, notebookDocked);
    await page.reload();
    await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
    await page.locator('h3', { hasText: 'Ryu' }).click();
    await page.evaluate(async () => {
      const path = '/src/lib/storage/indexedDbStorage.ts';
      const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
      const saveOpen = indexedDbStorage.settings.setNotebookOpen;
      let failOnce = true;
      indexedDbStorage.settings.setNotebookOpen = (id, open) => {
        if (!failOnce) return saveOpen(id, open);
        failOnce = false;
        return new Promise<void>((_resolve, reject) => Object.assign(window, { failNotebookOpen: () => reject(new Error('Storage unavailable')) }));
      };
    });
    const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
    await toggle.click();
    const drawer = page.getByRole(notebookDocked ? 'complementary' : 'dialog', { name: 'Ryu Notebook' });
    const focused = notebookDocked ? drawer.getByRole('button', { name: 'Undock', exact: true }) : drawer.getByRole('tab', { name: 'Notes', exact: true });
    await expect(focused).toBeFocused();
    await page.evaluate(() => (window as unknown as { failNotebookOpen: () => void }).failNotebookOpen());
    await expect(drawer).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(drawer).toBeVisible();
    await expect(focused).toBeFocused();
  });
}

test('restores focus to the docking control when saving a layout preference fails', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const save = indexedDbStorage.settings.update;
    let failOnce = true;
    indexedDbStorage.settings.update = updates => {
      if (!failOnce || updates.notebookDocked === undefined) return save(updates);
      failOnce = false;
      return new Promise<void>((_resolve, reject) => Object.assign(window, { failNotebookDock: () => reject(new Error('Storage unavailable')) }));
    };
  });
  const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await drawer.getByRole('button', { name: 'Dock', exact: true }).click();
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(dock.getByRole('button', { name: 'Undock', exact: true })).toBeFocused();
  await page.evaluate(() => (window as unknown as { failNotebookDock: () => void }).failNotebookDock());
  await expect(drawer.getByRole('button', { name: 'Dock', exact: true })).toBeFocused();
  await drawer.getByRole('button', { name: 'Dock', exact: true }).click();
  await expect(dock.getByRole('button', { name: 'Undock', exact: true })).toBeFocused();
});

test('preserves outside focus through responsive layout changes and remembered docking', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await drawer.getByRole('button', { name: 'Edit note', exact: true }).click();
  await expect(drawer.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  await drawer.getByRole('button', { name: 'Dock', exact: true }).click();
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(dock.getByRole('button', { name: 'Undock', exact: true })).toBeFocused();
  const outside = page.getByRole('button', { name: 'Export data', exact: true });
  for (const section of ['notes', 'resources']) {
    if (section === 'resources') {
      await dock.getByRole('tab', { name: /^Resources/ }).click();
      await dock.getByRole('button', { name: 'Add resource link', exact: true }).click();
      await expect(dock.getByRole('textbox', { name: 'URL', exact: true })).toBeFocused();
    }
    await outside.focus();
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(drawer).toBeVisible();
    await expect(outside).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(dock).toBeVisible();
    await expect(outside).toBeFocused();
  }
  await dock.getByRole('button', { name: 'Undock', exact: true }).click();
  await expect(drawer.getByRole('button', { name: 'Dock', exact: true })).toBeFocused();
  await drawer.getByRole('button', { name: 'Dock', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return (await indexedDbStorage.settings.get()).notebookDocked;
  })).toBe(true);
  await page.reload();
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Undock', exact: true })).not.toBeFocused();
});

test('docks beside the workspace, preserves drafts through resizing, and restores the docking choice', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  let drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await drawer.getByRole('button', { name: 'Dock', exact: true }).click();
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(dock.locator('.notebook-docked-header')).toHaveCount(0);
  await expect(dock.getByText('fireballs', { exact: true })).toBeVisible();
  await expect(dock.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: 'Edit note', exact: true })).toBeVisible();
  await expect(dock.getByRole('heading', { name: 'Notes', exact: true })).toHaveCount(0);
  await checkNoteEditPosition(dock);
  await page.screenshot({ path: testInfo.outputPath('notebook-docked.png') });
  await dock.getByRole('button', { name: 'Undock', exact: true }).click();
  await drawer.getByRole('button', { name: 'Edit note', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'Note', exact: true }).fill('Draft survives **docking**');
  await drawer.getByRole('button', { name: 'Dock', exact: true }).click();
  await expect(dock).toBeVisible();
  await expect(drawer).toHaveCount(0);
  await expect(dock.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Draft survives **docking**');
  await dock.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(dock.getByText('docking', { exact: true })).toHaveJSProperty('tagName', 'STRONG');

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1100, height: 600 }]) {
    await page.setViewportSize(viewport);
    await expect(dock).toBeVisible();
    const main = await page.locator('.notebook-main').boundingBox();
    const sidebar = await dock.boundingBox();
    expect((main?.x ?? 0) + (main?.width ?? 0)).toBeLessThan(sidebar?.x ?? 0);
    expect((sidebar?.y ?? 0) + (sidebar?.height ?? 0)).toBeLessThanOrEqual(viewport.height - 32);
    expect(await dock.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Add Combo', exact: true }).click();
    const comboEditor = page.getByRole('dialog', { name: 'Add Combo for Ryu', exact: true });
    await expect(comboEditor).toBeVisible();
    await comboEditor.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dock).toBeVisible();
  }

  await dock.getByRole('tab', { name: /^Resources/ }).click();
  await dock.getByRole('button', { name: 'Add resource link', exact: true }).click();
  await dock.getByRole('textbox', { name: 'URL', exact: true }).fill('https://example.com/docked');
  await dock.getByRole('textbox', { name: /Label/ }).fill('Docked guide');
  for (const viewport of [{ width: 1099, height: 600 }, { width: 800, height: 600 }, { width: 375, height: 700 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
    await expect(drawer).toBeVisible();
    await expect(dock).toHaveCount(0);
    await expect(drawer.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue('https://example.com/docked');
    expect(await drawer.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const box = await drawer.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
    await expect(drawer.getByRole('button', { name: 'Dock', exact: true })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: 'Undock', exact: true })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue('https://example.com/docked');
  await dock.getByRole('button', { name: 'Add resource', exact: true }).click();
  await expect(dock.getByRole('link', { name: 'Open Docked guide in a new tab', exact: true })).toBeVisible();
  await dock.getByRole('tab', { name: 'Notes', exact: true }).click();
  await dock.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(dock.getByText('docking', { exact: true })).toBeVisible();
  await dock.getByRole('button', { name: 'Close notebook', exact: true }).click();
  await expect(dock).toHaveCount(0);
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  await expect(dock).toBeVisible();
  await dock.getByRole('button', { name: 'Undock', exact: true }).click();
  await expect(drawer).toBeVisible();
  await expect(dock).toHaveCount(0);
});

test('keeps game notes concise in floating and docked panels and allows character navigation', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Street Fighter 6 Notebook' });
  await expect(drawer.getByRole('heading', { name: 'Notes', exact: true })).toHaveCount(1);
  await expect(drawer.locator('.notebook-section-heading')).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Edit note', exact: true })).toHaveText('Edit');
  await expect(drawer.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: 'Edit note', exact: true })).toBeVisible();
  await expect(drawer.locator('.notebook-panel-toolbar').getByRole('button', { name: 'Edit note', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('game-notes-floating.png') });
  await page.getByRole('button', { name: 'Dock', exact: true }).click();
  const dock = page.getByRole('complementary', { name: 'Street Fighter 6 Notebook' });
  await expect(dock.getByRole('heading', { name: 'Notes', exact: true })).toHaveCount(1);
  await expect(dock.locator('.notebook-section-heading')).toHaveCount(0);
  await expect(dock.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: 'Edit note', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('game-notes-docked.png') });
  await expect(dock.getByText('Practice session', { exact: true })).toBeVisible();
  await dock.getByRole('button', { name: 'Edit note', exact: true }).click();
  await expect(dock.getByRole('heading', { name: 'Notes', exact: true })).toHaveCount(1);
  await expect(dock.getByRole('heading', { name: 'Edit Note', exact: true })).toHaveCount(0);
  await expect(dock.getByRole('button', { name: 'Save Note', exact: true })).toHaveText('Save');
  await dock.getByRole('textbox', { name: 'Note', exact: true }).fill('');
  await dock.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(dock.getByText('Nothing saved yet.', { exact: true })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Add note', exact: true })).toHaveText('Add');
  await expect(dock.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: 'Add note', exact: true })).toBeVisible();
  await expect(dock.locator('.notebook-panel-toolbar').getByRole('button', { name: 'Add note', exact: true })).toHaveCount(0);
  await dock.getByRole('button', { name: 'Add note', exact: true }).click();
  await dock.getByRole('textbox', { name: 'Note', exact: true }).fill('Docked game note');
  await dock.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(dock.getByText('Docked game note', { exact: true })).toBeVisible();
  for (const width of [1099, 800, 320]) {
    await page.setViewportSize({ width, height: 600 });
    await expect(drawer.getByRole('heading', { name: 'Notes', exact: true })).toHaveCount(1);
    await expect(drawer.getByRole('button', { name: 'Edit note', exact: true })).toHaveText('Edit');
    expect(await drawer.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(dock).toBeVisible();
  await page.locator('h3', { hasText: 'Empty notebook' }).click();
  await expect(dock).toHaveCount(0);
  await expect(page.getByText('Docked game note', { exact: true })).toHaveCount(0);
});

test('resizes the dock by dragging or keyboard without squeezing the workspace, and keeps the width when reopened', async ({ page }, testInfo) => {
  const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
  await toggle.click();
  await page.getByRole('button', { name: 'Dock', exact: true }).click();
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  const handle = dock.getByRole('separator', { name: 'Notebook width' });
  await expect(page.getByRole('button', { name: 'Reference', exact: true })).toHaveCount(0);
  const drag = async (delta: number) => {
    const savedWidth = await readDockWidth(page);
    const box = await handle.boundingBox();
    if (!box) throw new Error('The dock resize handle is missing');
    const x = box.x + box.width / 2;
    const y = box.y + 40;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - delta, y, { steps: 8 });
    expect(await readDockWidth(page)).toBe(savedWidth);
    await page.mouse.up();
    await expect(dock).toHaveAttribute('data-resizing', 'false');
    await expect.poll(() => readDockWidth(page)).toBe(Number(await handle.getAttribute('aria-valuenow')));
  };
  await drag(150);
  await expect(handle).toHaveAttribute('aria-valuenow', '550');
  await expect(dock).toHaveCSS('width', '550px');
  await page.screenshot({ path: testInfo.outputPath('notebook-resized.png') });
  await drag(400);
  await expect(handle).toHaveAttribute('aria-valuenow', '600');
  await drag(-600);
  await expect(handle).toHaveAttribute('aria-valuenow', '320');
  await handle.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '340');
  await handle.press('End');
  await expect(handle).toHaveAttribute('aria-valuenow', '600');
  await page.setViewportSize({ width: 1100, height: 600 });
  await expect(handle).toHaveAttribute('aria-valuemax', /^[3-5]\d{2}$/);
  const maximum = await handle.getAttribute('aria-valuemax');
  await expect(handle).toHaveAttribute('aria-valuenow', maximum ?? '');
  const main = await page.locator('.notebook-main').boundingBox();
  expect(main?.width).toBeGreaterThanOrEqual(459);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(handle).toHaveAttribute('aria-valuenow', '600');
  await toggle.click();
  await expect(dock).toHaveCount(0);
  await toggle.click();
  await expect(handle).toHaveAttribute('aria-valuenow', '600');
  await handle.dblclick();
  await expect(handle).toHaveAttribute('aria-valuenow', '400');
  await dock.getByRole('button', { name: 'Undock', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await expect(drawer).toBeVisible();
  await drawer.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Dock', exact: true }).click();
  await expect(handle).toHaveAttribute('aria-valuenow', '400');
});

test('uses space outside the centered container for the dock while preserving the main column on wide windows', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1100 });
  const main = page.locator('.notebook-main');
  const original = await main.boundingBox();
  if (!original) throw new Error('The main workspace is missing');
  const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
  await toggle.click();
  await page.getByRole('button', { name: 'Dock', exact: true }).click();
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  const handle = dock.getByRole('separator', { name: 'Notebook width' });
  const checkBounds = async () => {
    const normal = await page.locator('main').evaluate(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const left = Number.parseFloat(style.paddingLeft);
      const right = Number.parseFloat(style.paddingRight);
      return { x: rect.x + left, width: rect.width - left - right };
    });
    const sidebar = await dock.boundingBox();
    const workspace = await main.boundingBox();
    if (!sidebar || !workspace) throw new Error('The docked workspace is missing');
    expect(workspace.x).toBeCloseTo(normal.x, 0);
    expect(workspace.width).toBeCloseTo(normal.width, 0);
    expect(sidebar.x).toBeGreaterThan(normal.x + normal.width);
    expect(sidebar.x + sidebar.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) - 16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  };
  await expect(handle).toHaveAttribute('aria-valuenow', '400');
  await checkBounds();
  await page.screenshot({ path: testInfo.outputPath('notebook-wide-window.png') });
  await handle.press('Home');
  await checkBounds();
  await handle.press('End');
  await expect(handle).toHaveAttribute('aria-valuenow', '600');
  const sidebar = await dock.boundingBox();
  const expanded = await main.boundingBox();
  if (!sidebar || !expanded) throw new Error('The expanded dock is missing');
  expect(expanded.x).toBeCloseTo(original.x, 0);
  expect(expanded.width).toBeGreaterThan(original.width - 130);
  expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(2544);
  await page.setViewportSize({ width: 3000, height: 1100 });
  await checkBounds();
  await page.setViewportSize({ width: 1920, height: 1080 });
  const narrowerMain = await main.boundingBox();
  const narrowerDock = await dock.boundingBox();
  const container = await page.locator('main').boundingBox();
  if (!narrowerMain || !narrowerDock || !container) throw new Error('The responsive dock is missing');
  expect(narrowerDock.x + narrowerDock.width).toBeGreaterThan(container.x + container.width);
  expect(narrowerDock.x + narrowerDock.width).toBeLessThanOrEqual(1904);
  expect(narrowerMain.x + narrowerMain.width).toBeLessThan(narrowerDock.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await dock.getByRole('tab', { name: /^Resources/ }).click();
  await expect(dock.getByRole('link', { name: 'Open Matchup guide in a new tab', exact: true })).toBeVisible();
  await toggle.click();
  await expect(dock).toHaveCount(0);
  const restored = await main.boundingBox();
  expect(restored?.width).toBeCloseTo(original.width, 0);
});

test('keeps the dock right edge anchored while dragging through the outer-margin transition', async ({ page }) => {
  for (const width of [2560, 3000]) {
    await page.setViewportSize({ width, height: 1100 });
    const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
    if (await drawer.count()) await drawer.getByRole('button', { name: 'Dock', exact: true }).click();
    const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
    const handle = dock.getByRole('separator', { name: 'Notebook width' });
    await handle.press('End');
    await expect(dock).toHaveCSS('width', '600px');
    const initial = await dock.boundingBox();
    const grip = await handle.boundingBox();
    if (!initial || !grip) throw new Error('The dock resize handle is missing');
    const x = grip.x + grip.width / 2;
    const y = grip.y + 40;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (const offset of [80, 160, 240, 280]) {
      await page.mouse.move(x + offset, y, { steps: 6 });
      await expect(dock).toHaveCSS('width', `${600 - offset}px`);
      const current = await dock.boundingBox();
      if (!current) throw new Error('The resized dock is missing');
      expect(current.x).toBeCloseTo(initial.x + offset, 0);
      expect(current.x + current.width).toBeCloseTo(initial.x + initial.width, 0);
    }
    await page.mouse.move(x + 400, y, { steps: 4 });
    await expect(dock).toHaveCSS('width', '320px');
    await page.mouse.up();
    await expect(dock).toHaveAttribute('data-resizing', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await dock.getByRole('tab', { name: /^Resources/ }).click();
    await expect(dock.getByRole('link', { name: 'Open Matchup guide in a new tab', exact: true })).toBeVisible();
  }
});

test('keeps notebook controls in the toolbar and preserves drafts during selection', async ({ page }, testInfo) => {
  const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
  const toolbar = page.locator('.notebook-trigger-slot').locator('..');
  await expect(toolbar.getByRole('button', { name: 'Add Combo', exact: true })).toBeVisible();
  await toggle.click();
  const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await drawer.getByRole('button', { name: 'Edit note', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'Note', exact: true }).fill('Selection draft');
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Select Combos', exact: true }).click();
  await expect(toggle).toHaveCount(1);
  await expect(toolbar.getByRole('button', { name: 'Select All', exact: true })).toBeVisible();
  await toggle.click();
  await expect(drawer.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Selection draft');
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  await toolbar.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(toolbar.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Add Character', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('notebook-game-toolbar.png') });
  for (const width of [1440, 1100, 800, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(toolbar.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test('fits the dock above the footer without adding page scroll and scrolls long notes internally', async ({ page }, testInfo) => {
  const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
  await toggle.click();
  await page.getByRole('button', { name: 'Dock', exact: true }).click();
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1440, height: 600 }, { width: 2560, height: 720 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
    const sidebar = await dock.boundingBox();
    const footer = await page.locator('footer').boundingBox();
    if (!sidebar || !footer) throw new Error('The dock or footer is missing');
    expect(sidebar.y + sidebar.height).toBeLessThanOrEqual(footer.y - 31);
    await checkNoteEditPosition(dock);
  }
  await page.setViewportSize({ width: 1440, height: 720 });
  await dock.getByRole('button', { name: 'Edit note', exact: true }).click();
  await dock.getByRole('textbox', { name: 'Note', exact: true }).fill(Array.from({ length: 60 }, (_, i) => `Practice reminder ${i + 1}`).join('\n\n'));
  await dock.getByRole('button', { name: 'Save Note', exact: true }).click();
  const body = dock.locator('[data-slot="dialog-body"]');
  await expect.poll(() => body.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(dock.getByText('Practice reminder 60', { exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('notebook-dock-fits-window.png') });
});

test('remembers dock mode and adjusted width across navigation and reloads without replacing them on small windows', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  await page.getByRole('button', { name: 'Dock', exact: true }).click();
  const readPreference = () => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return (await indexedDbStorage.settings.get()).notebookDocked;
  });
  await expect.poll(readPreference).toBe(true);
  const gameDock = page.getByRole('complementary', { name: 'Street Fighter 6 Notebook' });
  const characterDock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(characterDock).toBeVisible();
  await characterDock.getByRole('separator', { name: 'Notebook width' }).press('End');
  await expect.poll(() => readDockWidth(page)).toBe(600);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(gameDock).toBeVisible();
  await expect(gameDock.getByRole('separator', { name: 'Notebook width' })).toHaveAttribute('aria-valuenow', '600');
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(characterDock).toBeVisible();
  await expect(characterDock.getByRole('separator', { name: 'Notebook width' })).toHaveAttribute('aria-valuenow', '600');
  await page.reload();
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await expect(gameDock).toBeVisible();
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(characterDock).toBeVisible();

  await page.setViewportSize({ width: 1100, height: 900 });
  const widthHandle = characterDock.getByRole('separator', { name: 'Notebook width' });
  await expect(widthHandle).toHaveAttribute('aria-valuemax', /^[3-5]\d{2}$/);
  await expect(widthHandle).toHaveAttribute('aria-valuenow', await widthHandle.getAttribute('aria-valuemax') ?? '');
  expect(await readDockWidth(page)).toBe(600);
  await page.reload();
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(widthHandle).toBeVisible();
  expect(await readDockWidth(page)).toBe(600);

  await page.setViewportSize({ width: 800, height: 900 });
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await expect(floating).toBeVisible();
  await expect(characterDock).toHaveCount(0);
  await expect(floating.getByRole('button', { name: 'Dock', exact: true })).toHaveCount(0);
  await expect.poll(readPreference).toBe(true);
  await page.reload();
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await page.getByRole('dialog', { name: 'Street Fighter 6 Notebook' }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(floating).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(characterDock).toBeVisible();
  await expect(floating).toHaveCount(0);
  await expect(widthHandle).toHaveAttribute('aria-valuenow', '600');
  await widthHandle.dblclick();
  await expect.poll(() => readDockWidth(page)).toBe(400);
  await characterDock.getByRole('button', { name: 'Undock', exact: true }).click();
  await expect.poll(readPreference).toBe(false);
  await expect(floating).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Street Fighter 6 Notebook' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const game = (await indexedDbStorage.games.getAll()).find(item => item.name === 'Street Fighter 6');
    const saved = await indexedDbStorage.settings.get();
    return game ? saved.notebookOpenPages?.includes(game.id) : undefined;
  })).toBe(true);
  await page.reload();
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await expect(page.getByRole('dialog', { name: 'Street Fighter 6 Notebook' })).toBeVisible();
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(floating).toBeVisible();
  await expect(characterDock).toHaveCount(0);
});
