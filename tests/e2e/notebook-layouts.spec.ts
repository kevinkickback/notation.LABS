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

async function notebookPlacement(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const settings = await indexedDbStorage.settings.get();
    return { docked: settings.notebookDocked, side: settings.notebookDockSide, position: settings.notebookFloatingPosition, size: settings.notebookFloatingSize };
  });
}

test('keeps the same editor and caret through snapping and responsive layouts', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await floating.getByRole('button', { name: 'Edit note', exact: true }).click();
  const note = floating.getByRole('textbox', { name: 'Note', exact: true });
  await note.fill('Keep the same editor and selection');
  await note.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(5, 14));
  const editor = await note.elementHandle();
  if (!editor) throw new Error('The note editor is missing');
  await beginNotebookDrag(page, floating);
  await page.mouse.move(24, 180, { steps: 8 });
  await page.mouse.up();
  const docked = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(docked).toBeVisible();
  for (const width of [800, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(width === 800 ? floating : docked).toBeVisible();
    expect(await editor.evaluate(element => element.isConnected && document.activeElement === element)).toBe(true);
    expect(await editor.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([5, 14]);
  }
  await chooseNotebookLayout(page, 'Floating');
  await expect(floating).toBeVisible();
  expect(await editor.evaluate(element => element.isConnected)).toBe(true);
  expect(await editor.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([5, 14]);
});

async function beginNotebookDrag(page: Page, panel: Locator) {
  const grip = await panel.getByRole('button', { name: 'Move notebook', exact: true }).boundingBox();
  if (!grip) throw new Error('Missing notebook movement handle');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
}

async function chooseNotebookLayout(page: Page, name: string) {
  await page.getByRole('button', { name: 'Notebook layout', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

async function resizeFloatingNotebook(page: Page, panel: Locator, x: number, y: number) {
  const grip = await panel.getByRole('button', { name: 'Resize notebook', exact: true }).boundingBox();
  if (!grip) throw new Error('Missing floating notebook resize handle');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + x, grip.y + grip.height / 2 + y, { steps: 8 });
}

test('resizes the floating notebook within bounds and remembers its size across pages and restarts', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await floating.getByRole('button', { name: 'Edit note', exact: true }).click();
  await floating.getByRole('textbox', { name: 'Note', exact: true }).fill('Unsaved resize draft');
  const original = await floating.boundingBox();
  const saved = await notebookPlacement(page);
  await resizeFloatingNotebook(page, floating, -140, 80);
  await expect(floating).toHaveAttribute('data-resizing', 'true');
  await expect(floating).toHaveCSS('width', '620px');
  await expect(floating).toHaveCSS('height', '720px');
  await expect(page.locator('.notebook-snap-preview')).toHaveCount(0);
  expect(await notebookPlacement(page)).toEqual(saved);
  await page.mouse.up();
  await expect(floating).toHaveAttribute('data-resizing', 'false');
  await expect.poll(async () => (await notebookPlacement(page)).size).toEqual({ width: 620, height: 720 });
  const resized = await floating.boundingBox();
  expect(resized?.y).toBeCloseTo(original?.y ?? -1, 0);
  expect((resized?.x ?? 0) + (resized?.width ?? 0)).toBeCloseTo((original?.x ?? -1) + (original?.width ?? 0), 0);
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Unsaved resize draft');
  await page.screenshot({ path: testInfo.outputPath('notebook-floating-resized.png') });
  await chooseNotebookLayout(page, 'Dock left');
  await chooseNotebookLayout(page, 'Floating');
  await expect(floating).toHaveCSS('width', '620px');
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Unsaved resize draft');
  const remembered = await notebookPlacement(page);
  for (const viewport of [{ width: 1100, height: 500 }, { width: 800, height: 600 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    const box = await floating.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
    expect(await floating.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    if (viewport.width < 1100) await expect(floating.getByRole('button', { name: 'Resize notebook', exact: true })).toHaveCount(0);
    expect(await notebookPlacement(page)).toEqual(remembered);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(floating).toHaveCSS('height', '720px');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  const gamePanel = page.getByRole('dialog', { name: 'Street Fighter 6 Notebook' });
  await expect(gamePanel).toHaveCSS('width', '620px');
  await expect(gamePanel).toHaveCSS('height', '720px');
  // Opening is optimistic; let the preference commit before testing a restart.
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const game = (await indexedDbStorage.games.getAll()).find(game => game.name === 'Street Fighter 6');
    return !!game && (await indexedDbStorage.settings.get()).notebookOpenPages?.includes(game.id);
  })).toBe(true);
  await page.reload();
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await expect(gamePanel).toHaveCSS('width', '620px');
  await gamePanel.getByRole('button', { name: 'Resize notebook', exact: true }).press('Shift+ArrowRight');
  await gamePanel.getByRole('button', { name: 'Resize notebook', exact: true }).press('ArrowUp');
  await expect(gamePanel).toHaveCSS('width', '670px');
  await expect(gamePanel).toHaveCSS('height', '700px');
  await resizeFloatingNotebook(page, gamePanel, -2000, 2000);
  await expect(gamePanel).toHaveCSS('width', '800px');
  await expect(gamePanel).toHaveCSS('height', '868px');
  await page.mouse.up();
  await resizeFloatingNotebook(page, gamePanel, 2000, -2000);
  await expect(gamePanel).toHaveCSS('width', '320px');
  await expect(gamePanel).toHaveCSS('height', '280px');
  await page.mouse.up();
  expect(await gamePanel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('.notebook-snap-preview')).toHaveCount(0);
});

test('cancels floating resizing and rolls a failed save back without losing the note draft', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await floating.getByRole('button', { name: 'Edit note', exact: true }).click();
  await floating.getByRole('textbox', { name: 'Note', exact: true }).fill('Keep this resize draft');
  const saved = await notebookPlacement(page);
  for (const cancellation of ['escape', 'pointer', 'blur', 'capture']) {
    await resizeFloatingNotebook(page, floating, -70, 40);
    await expect(floating).toHaveAttribute('data-resizing', 'true');
    if (cancellation === 'escape') await page.keyboard.press('Escape');
    else await page.evaluate(kind => {
      if (kind === 'capture') document.querySelector('.notebook-workspace')?.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1 }));
      else window.dispatchEvent(kind === 'pointer' ? new PointerEvent('pointercancel', { pointerId: 1 }) : new Event('blur'));
    }, cancellation);
    await expect(floating).toHaveAttribute('data-resizing', 'false');
    await page.mouse.up();
    await expect(floating).toHaveCSS('width', '480px');
    await expect(floating).toHaveCSS('height', '640px');
    expect(await notebookPlacement(page)).toEqual(saved);
  }
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const update = indexedDbStorage.settings.update;
    let failOnce = true;
    indexedDbStorage.settings.update = updates => {
      if (!failOnce || updates.notebookFloatingSize === undefined) return update(updates);
      failOnce = false;
      return new Promise<void>((_resolve, reject) => Object.assign(window, { rejectNotebookResize: () => reject(new Error('Storage unavailable')) }));
    };
  });
  await resizeFloatingNotebook(page, floating, -70, 40);
  await page.mouse.up();
  await expect(floating).toHaveCSS('width', '550px');
  await page.evaluate(() => (window as unknown as { rejectNotebookResize: () => void }).rejectNotebookResize());
  await expect(floating).toHaveCSS('width', '480px');
  await expect(floating).toHaveCSS('height', '640px');
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Keep this resize draft');
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  expect(await notebookPlacement(page)).toEqual(saved);
  await resizeFloatingNotebook(page, floating, -70, 40);
  await page.mouse.up();
  await expect.poll(async () => (await notebookPlacement(page)).size).toEqual({ width: 550, height: 680 });
});

test('previews docking from the moving panel edge before the cursor reaches the app edge', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await expect(floating.locator('.notebook-panel-tools > button')).toHaveCount(2);
  await floating.getByRole('button', { name: 'Notebook layout', exact: true }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Floating', 'Dock left', 'Dock right']);
  await expect(page.getByRole('menuitem', { name: 'Floating', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('menuitem', { name: /Reset/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const toolbar = await floating.locator('.notebook-panel-toolbar').boundingBox();
  if (!toolbar) throw new Error('Missing notebook toolbar');
  const x = toolbar.x + 240;
  const y = toolbar.y + toolbar.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 4 });
  await expect(page.locator('.notebook-snap-preview')).toHaveCount(0);
  await page.mouse.move(x - 120, y + 40, { steps: 4 });
  await expect(page.locator('.notebook-snap-preview')).toHaveCount(0);
  await page.mouse.up();
  const movedToolbar = await floating.locator('.notebook-panel-toolbar').boundingBox();
  if (!movedToolbar) throw new Error('Missing moved notebook toolbar');
  await page.mouse.move(movedToolbar.x + 240, movedToolbar.y + movedToolbar.height / 2);
  await page.mouse.down();
  await page.mouse.move(260, 230, { steps: 8 });
  const preview = page.locator('.notebook-snap-preview');
  await expect(preview).toHaveText('Dock left');
  expect((await notebookPlacement(page)).docked).toBe(false);
  await page.mouse.move(650, 230, { steps: 8 });
  await expect(preview).toHaveCount(0);
  await page.mouse.move(1180, 230, { steps: 8 });
  await expect(preview).toHaveText('Dock right');
  await page.mouse.up();
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(dock).toHaveAttribute('data-side', 'right');
  await dock.getByRole('button', { name: 'Notebook layout', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Dock right', exact: true })).toHaveAttribute('aria-current', 'true');
});

test('groups Notes with the toolbar actions after Search across window sizes', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const search = page.getByPlaceholder('Search characters...');
  const notes = page.getByRole('button', { name: 'Notes', exact: true });
  const actions = page.locator('.notebook-trigger-slot').locator('..');
  await expect(actions.getByRole('button')).toHaveText(['Notes', 'Sort', 'View', '', 'Add Character']);
  await search.focus();
  await search.press('Tab');
  await expect(notes).toBeFocused();
  const title = page.getByRole('heading', { name: 'Street Fighter 6', exact: true });
  const identity = title.locator('..').locator('..');
  const toolbar = search.locator('..').locator('..');
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1040, height: 735 }, { width: 959, height: 735 }, { width: 800, height: 600 }, { width: 640, height: 600 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    const searchBox = await search.boundingBox();
    const actionsBox = await actions.boundingBox();
    if (!searchBox || !actionsBox) throw new Error('Missing character toolbar');
    expect(searchBox.y).toBeLessThanOrEqual(actionsBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(notes).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Add Character', exact: true })).toBeVisible();
    const identityBox = await identity.boundingBox();
    const toolbarBox = await toolbar.boundingBox();
    const mainBox = await page.locator('.notebook-main').boundingBox();
    if (!identityBox || !toolbarBox || !mainBox) throw new Error('Missing game page header');
    expect(identityBox.width).toBeGreaterThanOrEqual(Math.min(320, mainBox.width) - 1);
    expect(await title.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    if (toolbarBox.y < identityBox.y + identityBox.height) expect(toolbarBox.x).toBeGreaterThanOrEqual(identityBox.x + identityBox.width + 15);
    else expect(toolbarBox.y).toBeGreaterThanOrEqual(identityBox.y + identityBox.height + 15);
    if (viewport.width === 959) await page.screenshot({ path: testInfo.outputPath('game-header-959.png') });
  }
  await page.screenshot({ path: testInfo.outputPath('notebook-toolbar-narrow.png') });
});

test('keeps the game title and toolbar usable when either notebook dock constrains the page', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  const title = page.getByRole('heading', { name: 'Street Fighter 6', exact: true }).first();
  const identity = title.locator('..').locator('..');
  for (const side of ['left', 'right']) {
    await chooseNotebookLayout(page, `Dock ${side}`);
    const dock = page.getByRole('complementary', { name: 'Street Fighter 6 Notebook' });
    await dock.getByRole('separator', { name: 'Notebook width', exact: true }).press('End');
    for (const width of [1100, 1173, 1440, 2560]) {
      await page.setViewportSize({ width, height: 890 });
      const identityBox = await identity.boundingBox();
      const mainBox = await page.locator('.notebook-main').boundingBox();
      if (!identityBox || !mainBox) throw new Error('Missing docked game header');
      expect(identityBox.width).toBeGreaterThanOrEqual(Math.min(320, mainBox.width) - 1);
      expect(await title.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await expect(page.getByRole('button', { name: 'Add Character', exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('Search characters...')).toBeVisible();
      if (width === 1173) await page.screenshot({ path: testInfo.outputPath(`game-header-dock-${side}.png`) });
    }
  }
  await page.setViewportSize({ width: 959, height: 735 });
  await page.getByRole('dialog', { name: 'Street Fighter 6 Notebook' }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Select Characters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select All', exact: true })).toBeVisible();
  expect((await identity.boundingBox())?.width).toBeGreaterThanOrEqual(320);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByPlaceholder('Search characters...')).toBeVisible();
});

test('spreads combo details below the actions in narrow cards and preserves their controls', async ({ page }, testInfo) => {
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const combo = (await indexedDbStorage.combos.getAll())[0];
    await indexedDbStorage.combos.update(combo.id, { outdated: true, difficulty: 2, damage: '4200', meterCost: '1 bar', tags: ['BnB', 'Corner', 'Infinite'], demoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  });
  const card = page.locator('.combo-card').filter({ has: page.getByRole('heading', { name: 'Mid-screen confirm', exact: true }) });
  const metadata = card.locator('.combo-card-metadata');
  const actions = card.locator('.combo-card-actions');
  await expect(metadata.getByText('Difficulty: 2/5', { exact: true })).toBeVisible();
  await expect(metadata.locator('[data-slot="badge"]')).toHaveCount(7);
  const checkNarrowCard = async () => {
    const metadataBox = await metadata.boundingBox();
    const actionsBox = await actions.boundingBox();
    if (!metadataBox || !actionsBox) throw new Error('Missing combo controls');
    expect(metadataBox.y).toBeGreaterThanOrEqual(actionsBox.y + actionsBox.height + 7);
    expect(metadataBox.x).toBeCloseTo(actionsBox.x, 0);
    expect(metadataBox.width).toBeCloseTo(actionsBox.width, 0);
    const status = await metadata.getByText('Outdated', { exact: true }).boundingBox();
    const difficulty = await metadata.getByText('Difficulty: 2/5', { exact: true }).boundingBox();
    expect(status?.y).toBeCloseTo(difficulty?.y ?? -1, 0);
    expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    for (const name of ['Watch Demo', 'Edit combo', 'Duplicate combo', 'Delete combo']) {
      await expect(card.getByRole('button', { name, exact: true })).toHaveCount(1);
      await expect(card.getByRole('button', { name, exact: true })).toBeVisible();
    }
  };
  for (const width of [800, 640, 375, 320]) {
    await page.setViewportSize({ width, height: 890 });
    await checkNarrowCard();
    if (width === 320) await page.screenshot({ path: testInfo.outputPath('combo-details-320.png') });
  }
  await card.getByRole('button', { name: 'Edit combo', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Combo for Ryu', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await card.getByRole('button', { name: 'Duplicate combo', exact: true }).click();
  const copy = page.locator('.combo-card').filter({ has: page.getByRole('heading', { name: 'Mid-screen confirm (copy)', exact: true }) });
  await expect(copy).toBeVisible();
  await copy.getByRole('button', { name: 'Delete combo', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Delete combo?', exact: true });
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(copy).toHaveCount(0);
  await metadata.getByText('#Corner', { exact: true }).click();
  await expect(page.getByPlaceholder('Search combos...')).toBeVisible();
  await page.setViewportSize({ width: 1173, height: 890 });
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  await chooseNotebookLayout(page, 'Dock left');
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await dock.getByRole('separator', { name: 'Notebook width', exact: true }).press('End');
  await checkNarrowCard();
  await page.screenshot({ path: testInfo.outputPath('combo-details-docked.png') });
  await chooseNotebookLayout(page, 'Dock right');
  await checkNarrowCard();
});

test('moves and snaps the notebook on release while preserving both editor drafts', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await floating.getByRole('button', { name: 'Edit note', exact: true }).click();
  await floating.getByRole('textbox', { name: 'Note', exact: true }).fill('Unsaved movement draft');
  await beginNotebookDrag(page, floating);
  await page.mouse.move(640, 230, { steps: 8 });
  await page.mouse.up();
  const moved = await floating.boundingBox();
  if (!moved) throw new Error('Missing floating notebook');
  expect(moved.x).toBeLessThan(800);
  expect(moved.y).toBeGreaterThan(88);
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Unsaved movement draft');
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  await floating.getByRole('tab', { name: /^Resources/ }).click();
  await floating.getByRole('button', { name: 'Add resource link', exact: true }).click();
  await floating.getByRole('textbox', { name: 'URL', exact: true }).fill('https://example.com/unsaved');
  await beginNotebookDrag(page, floating);
  await page.mouse.move(24, 180, { steps: 8 });
  const preview = page.locator('.notebook-snap-preview');
  await expect(preview).toHaveText('Dock left');
  await expect(floating).toHaveAttribute('data-moving', 'true');
  expect((await notebookPlacement(page)).docked).toBe(false);
  const previewBox = await preview.boundingBox();
  await page.screenshot({ path: testInfo.outputPath('notebook-snap-left.png') });
  await page.mouse.up();
  const docked = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(docked).toHaveAttribute('data-side', 'left');
  await expect(preview).toHaveCount(0);
  const dockBox = await docked.boundingBox();
  expect(dockBox?.x).toBeCloseTo(previewBox?.x ?? -1, 0);
  expect(dockBox?.width).toBeCloseTo(previewBox?.width ?? -1, 0);
  expect(dockBox?.y).toBeCloseTo(previewBox?.y ?? -1, 0);
  expect(dockBox?.height).toBeCloseTo(previewBox?.height ?? -1, 0);
  await expect(docked.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue('https://example.com/unsaved');
  await beginNotebookDrag(page, docked);
  await page.mouse.move(700, 250, { steps: 8 });
  await page.mouse.up();
  await expect(floating).toBeVisible();
  await expect(floating.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue('https://example.com/unsaved');
  await floating.getByRole('tab', { name: 'Notes', exact: true }).click();
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Unsaved movement draft');
  await beginNotebookDrag(page, floating);
  await page.mouse.move(1416, 200, { steps: 8 });
  await expect(preview).toHaveText('Dock right');
  await page.mouse.up();
  await expect(docked).toHaveAttribute('data-side', 'right');
  await expect(docked.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Unsaved movement draft');
  await page.screenshot({ path: testInfo.outputPath('notebook-docked-right.png') });
});

test('cancels a movement with Escape, pointer cancellation, or window blur without closing or saving', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  const original = await floating.boundingBox();
  const saved = await notebookPlacement(page);
  for (const cancellation of ['escape', 'pointer', 'blur']) {
    await beginNotebookDrag(page, floating);
    await page.mouse.move(24, 180, { steps: 4 });
    await expect(page.locator('.notebook-snap-preview')).toBeVisible();
    if (cancellation === 'escape') await page.keyboard.press('Escape');
    else await page.evaluate(kind => window.dispatchEvent(kind === 'pointer'
      ? new PointerEvent('pointercancel', { pointerId: 1 }) : new Event('blur')), cancellation);
    await expect(floating).toHaveAttribute('data-moving', 'false');
    await page.mouse.up();
    await expect(floating).toBeVisible();
    await expect(page.locator('.notebook-snap-preview')).toHaveCount(0);
    const restored = await floating.boundingBox();
    expect(restored?.x).toBeCloseTo(original?.x ?? -1, 0);
    expect(restored?.y).toBeCloseTo(original?.y ?? -1, 0);
    expect(await notebookPlacement(page)).toEqual(saved);
  }
  await chooseNotebookLayout(page, 'Dock left');
  const docked = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await beginNotebookDrag(page, docked);
  await page.mouse.move(650, 240, { steps: 6 });
  await expect(floating).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(docked).toHaveAttribute('data-side', 'left');
  expect((await notebookPlacement(page)).side).toBe('left');
});

test('keeps a left dock outside the main column on wide windows and mirrors width adjustments', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1100 });
  const main = page.locator('.notebook-main');
  const original = await main.boundingBox();
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  await chooseNotebookLayout(page, 'Dock left');
  const docked = page.getByRole('complementary', { name: 'Ryu Notebook' });
  const handle = docked.getByRole('separator', { name: 'Notebook width' });
  const initialDock = await docked.boundingBox();
  const dockedMain = await main.boundingBox();
  expect(dockedMain?.x).toBeCloseTo(original?.x ?? -1, 0);
  expect(dockedMain?.width).toBeCloseTo(original?.width ?? -1, 0);
  expect((initialDock?.x ?? 0) + (initialDock?.width ?? 0)).toBeLessThan(original?.x ?? 0);
  await handle.press('Shift+ArrowRight');
  await expect(docked).toHaveCSS('width', '450px');
  await handle.press('End');
  await expect(docked).toHaveCSS('width', '600px');
  const grip = await handle.boundingBox();
  if (!grip) throw new Error('Missing left dock resize handle');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 40);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 - 280, grip.y + 40, { steps: 10 });
  await expect(docked).toHaveCSS('width', '320px');
  await page.mouse.up();
  expect((await docked.boundingBox())?.x).toBeCloseTo(initialDock?.x ?? -1, 0);
  expect(await docked.locator('.notebook-panel-content').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('notebook-docked-left-wide.png') });
  await page.setViewportSize({ width: 800, height: 600 });
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await expect(floating).toBeVisible();
  await expect(floating.getByRole('button', { name: 'Move notebook', exact: true })).toHaveCount(0);
  await expect(floating.getByRole('button', { name: 'Notebook layout', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 2560, height: 1100 });
  await expect(docked).toHaveAttribute('data-side', 'left');
  await expect(docked).toHaveCSS('width', '320px');
});

test('offers keyboard movement and remembers floating placement across pages and window sizes', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  const original = await floating.boundingBox();
  await floating.getByRole('button', { name: 'Move notebook', exact: true }).press('Shift+ArrowLeft');
  await floating.getByRole('button', { name: 'Move notebook', exact: true }).press('Shift+ArrowDown');
  await floating.getByRole('button', { name: 'Move notebook', exact: true }).press('Shift+ArrowLeft');
  const moved = await floating.boundingBox();
  expect(moved?.x).toBeCloseTo((original?.x ?? 0) - 100, 0);
  expect(moved?.y).toBeCloseTo((original?.y ?? 0) + 50, 0);
  const remembered = await notebookPlacement(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  const gamePanel = page.getByRole('dialog', { name: 'Street Fighter 6 Notebook' });
  expect((await gamePanel.boundingBox())?.x).toBeCloseTo(moved?.x ?? -1, 0);
  await gamePanel.getByRole('button', { name: 'Move notebook', exact: true }).press('ArrowLeft');
  await chooseNotebookLayout(page, 'Dock left');
  await expect(page.getByRole('complementary', { name: 'Street Fighter 6 Notebook' })).toHaveAttribute('data-side', 'left');
  await chooseNotebookLayout(page, 'Floating');
  await page.screenshot({ path: testInfo.outputPath('notebook-floating-game.png') });
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(floating).toBeVisible();
  expect((await floating.boundingBox())?.x).toBeCloseTo((moved?.x ?? 0) - 20, 0);
  const saved = await notebookPlacement(page);
  expect(saved.position).not.toEqual(remembered.position);
  await page.setViewportSize({ width: 1100, height: 600 });
  const constrained = await floating.boundingBox();
  expect((constrained?.x ?? 0) + (constrained?.width ?? 0)).toBeLessThanOrEqual(1100);
  expect((constrained?.y ?? 0) + (constrained?.height ?? 0)).toBeLessThanOrEqual(600);
  expect(await notebookPlacement(page)).toEqual(saved);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await page.locator('h3', { hasText: 'Ryu' }).click();
  expect((await floating.boundingBox())?.x).toBeCloseTo((moved?.x ?? 0) - 20, 0);
  expect(await notebookPlacement(page)).toEqual(saved);
});

test('rolls a failed snap back without losing the editor and keeps keyboard focus while undocking', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await floating.getByRole('button', { name: 'Edit note', exact: true }).click();
  await floating.getByRole('textbox', { name: 'Note', exact: true }).fill('Draft survives a failed snap');
  const saved = await notebookPlacement(page);
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const update = indexedDbStorage.settings.update;
    let failOnce = true;
    indexedDbStorage.settings.update = updates => {
      if (!failOnce || updates.notebookDockSide === undefined) return update(updates);
      failOnce = false;
      return new Promise<void>((_resolve, reject) => Object.assign(window, { rejectNotebookPlacement: () => reject(new Error('Storage unavailable')) }));
    };
  });
  await beginNotebookDrag(page, floating);
  await page.mouse.move(24, 180, { steps: 6 });
  await page.mouse.up();
  const docked = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(docked).toHaveAttribute('data-side', 'left');
  await expect(docked.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  await page.evaluate(() => (window as unknown as { rejectNotebookPlacement: () => void }).rejectNotebookPlacement());
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Draft survives a failed snap');
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  expect(await notebookPlacement(page)).toEqual(saved);
  await chooseNotebookLayout(page, 'Dock left');
  await docked.getByRole('button', { name: 'Move notebook', exact: true }).press('ArrowRight');
  await expect(floating.getByRole('button', { name: 'Move notebook', exact: true })).toBeFocused();
  await expect(floating.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Draft survives a failed snap');
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
    if (width >= 1100) await expect(drawer.getByRole('button', { name: 'Notebook layout', exact: true })).toBeEnabled();
    else {
      await expect(drawer.getByRole('button', { name: 'Notebook layout', exact: true })).toHaveCount(0);
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
  await expect(drawer.getByRole('alert')).toContainText('HTTPS');
  for (const [host, label] of [['localhost:3000/guide', ''], ['example.com:8080/guide', 'Port guide']]) {
    await url.fill(host);
    await drawer.getByRole('textbox', { name: /Label/ }).fill(label);
    await drawer.getByRole('button', { name: 'Add resource', exact: true }).click();
    const domain = new URL(`https://${host}`).host;
    const resource = drawer.getByRole('link', { name: `Open ${label || domain} in a new tab`, exact: true });
    await expect(resource).toHaveAttribute('href', `https://${host}`);
    await expect(resource.locator('small')).toHaveText(domain);
    if (!label) await drawer.getByRole('button', { name: 'Add resource link', exact: true }).click();
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
    if (notebookDocked) await chooseNotebookLayout(page, 'Dock right');
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
    const focused = notebookDocked ? drawer.getByRole('button', { name: 'Notebook layout', exact: true }) : drawer.getByRole('tab', { name: 'Notes', exact: true });
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
  await chooseNotebookLayout(page, 'Dock right');
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(dock.getByRole('button', { name: 'Notebook layout', exact: true })).toBeFocused();
  await page.evaluate(() => (window as unknown as { failNotebookDock: () => void }).failNotebookDock());
  await expect(drawer.getByRole('button', { name: 'Notebook layout', exact: true })).toBeFocused();
  await chooseNotebookLayout(page, 'Dock right');
  await expect(dock.getByRole('button', { name: 'Notebook layout', exact: true })).toBeFocused();
});

test('preserves outside focus through responsive layout changes and remembered docking', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await drawer.getByRole('button', { name: 'Edit note', exact: true }).click();
  await expect(drawer.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  await chooseNotebookLayout(page, 'Dock right');
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(dock.getByRole('button', { name: 'Notebook layout', exact: true })).toBeFocused();
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
  await chooseNotebookLayout(page, 'Floating');
  await expect(drawer.getByRole('button', { name: 'Notebook layout', exact: true })).toBeFocused();
  await chooseNotebookLayout(page, 'Dock right');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return (await indexedDbStorage.settings.get()).notebookDocked;
  })).toBe(true);
  await page.reload();
  await page.locator('h3', { hasText: 'Street Fighter 6' }).click();
  await page.locator('h3', { hasText: 'Ryu' }).click();
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Notebook layout', exact: true })).not.toBeFocused();
});

test('docks beside the workspace, preserves drafts through resizing, and restores the docking choice', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  let drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await chooseNotebookLayout(page, 'Dock right');
  const dock = page.getByRole('complementary', { name: 'Ryu Notebook' });
  await expect(dock.locator('.notebook-docked-header')).toHaveCount(0);
  await expect(dock.getByText('fireballs', { exact: true })).toBeVisible();
  await expect(dock.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: 'Edit note', exact: true })).toBeVisible();
  await expect(dock.getByRole('heading', { name: 'Notes', exact: true })).toHaveCount(0);
  await checkNoteEditPosition(dock);
  await page.screenshot({ path: testInfo.outputPath('notebook-docked.png') });
  await chooseNotebookLayout(page, 'Floating');
  await drawer.getByRole('button', { name: 'Edit note', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'Note', exact: true }).fill('Draft survives **docking**');
  await chooseNotebookLayout(page, 'Dock right');
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
    await expect(drawer.getByRole('button', { name: 'Notebook layout', exact: true })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: 'Resize notebook', exact: true })).toHaveCount(0);
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
  await chooseNotebookLayout(page, 'Floating');
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
  await chooseNotebookLayout(page, 'Dock right');
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
  await chooseNotebookLayout(page, 'Dock right');
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
  await chooseNotebookLayout(page, 'Floating');
  const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
  await expect(drawer).toBeVisible();
  await drawer.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expect(drawer).toBeVisible();
  await chooseNotebookLayout(page, 'Dock right');
  await expect(handle).toHaveAttribute('aria-valuenow', '400');
});

test('uses space outside the centered container for the dock while preserving the main column on wide windows', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1100 });
  const main = page.locator('.notebook-main');
  await expect.poll(() => main.evaluate(element => {
    const container = element.closest('main');
    if (!container) throw new Error('The main container is missing');
    const style = getComputedStyle(container);
    const availableWidth = container.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
    return element.getBoundingClientRect().width - availableWidth;
  })).toBeCloseTo(0, 0);
  const original = await main.boundingBox();
  if (!original) throw new Error('The main workspace is missing');
  const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
  await toggle.click();
  await chooseNotebookLayout(page, 'Dock right');
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
  await expect.poll(async () => (await main.boundingBox())?.width).toBeCloseTo(original.width, 0);
});

test('keeps the dock right edge anchored while dragging through the outer-margin transition', async ({ page }) => {
  for (const width of [2560, 3000]) {
    await page.setViewportSize({ width, height: 1100 });
    const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    const drawer = page.getByRole('dialog', { name: 'Ryu Notebook' });
    if (await drawer.count()) await chooseNotebookLayout(page, 'Dock right');
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
  await chooseNotebookLayout(page, 'Dock right');
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
  await expect(dock.getByRole('button', { name: 'Edit note', exact: true })).toBeFocused();
  const body = dock.locator('[data-slot="dialog-body"]');
  await expect(dock.getByRole('button', { name: 'Edit note', exact: true })).toBeFocused();
  await expect(dock.getByText('Practice reminder 60', { exact: true })).toBeVisible();
  await expect.poll(() => body.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(dock.getByText('Practice reminder 60', { exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('notebook-dock-fits-window.png') });
});

for (const kind of ['game', 'character'] as const) {
  test(`keeps dock controls clear of sticky navigation on a long ${kind} page`, async ({ page }) => {
    await page.evaluate(async target => {
      const path = '/src/lib/storage/indexedDbStorage.ts';
      const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
      const game = (await indexedDbStorage.games.getAll()).find(item => item.name === 'Street Fighter 6');
      if (!game) throw new Error('Missing seeded game');
      const character = (await indexedDbStorage.characters.getByGame(game.id)).find(item => item.name === 'Ryu');
      if (!character) throw new Error('Missing seeded character');
      for (let index = 0; index < 40; index++) {
        if (target === 'game') await indexedDbStorage.characters.add({ gameId: game.id, name: `Practice character ${index}` });
        else await indexedDbStorage.combos.add({ characterId: character.id, name: `Practice combo ${index}`, notation: '2M > 236H', parsedNotation: [], tags: [] });
      }
    }, kind);
    if (kind === 'game') await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: kind === 'game' ? 'Notes' : 'Notes & Resources', exact: true }).click();
    await chooseNotebookLayout(page, 'Dock right');
    const dock = page.getByRole('complementary', { name: `${kind === 'game' ? 'Street Fighter 6' : 'Ryu'} Notebook` });
    for (const height of [1000, 600]) {
      await page.setViewportSize({ width: 1440, height });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(500);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const sidebar = await dock.boundingBox();
      const navigationBottom = await page.locator('main').evaluate(element => element.previousElementSibling?.getBoundingClientRect().bottom ?? 0);
      const footer = await page.locator('footer').boundingBox();
      if (!sidebar || !footer) throw new Error('Missing dock or footer');
      expect(sidebar.y).toBeGreaterThanOrEqual(navigationBottom + 23);
      expect(sidebar.y + sidebar.height).toBeLessThanOrEqual(footer.y - 23);
      for (const name of ['Notebook layout', 'Close notebook']) {
        const control = dock.getByRole('button', { name, exact: true });
        await expect(control).toBeInViewport();
        expect(await control.evaluate(element => {
          const box = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        })).toBe(true);
      }
    }
    await chooseNotebookLayout(page, 'Floating');
    await expect(page.locator('.notebook-drawer')).toBeVisible();
  });
}

test('remembers dock mode and adjusted width across navigation and reloads without replacing them on small windows', async ({ page }) => {
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  await chooseNotebookLayout(page, 'Dock right');
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
  await expect(floating.getByRole('button', { name: 'Notebook layout', exact: true })).toHaveCount(0);
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
  await chooseNotebookLayout(page, 'Floating');
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
