import { describe, expect, it } from 'vitest';
import {
  characterLinkSchema,
  characterSchema,
  externalHttpUrlSchema,
  gameSchema,
  legacyGameSchema,
  settingsSchema,
} from '@/lib/schemas';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const timestamps = { createdAt: 1, updatedAt: 1 };

describe('notebook preference validation', () => {
  it('keeps older settings compatible and accepts either docking choice', () => {
    const { notebookDocked: _dock, notebookDockWidth: _width, ...legacy } = DEFAULT_SETTINGS;
    expect(settingsSchema.safeParse(legacy).success).toBe(true);
    for (const notebookDocked of [true, false]) {
      expect(settingsSchema.parse({ ...legacy, notebookDocked }).notebookDocked).toBe(notebookDocked);
    }
  });
  it('rejects invalid docking choices', () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, notebookDocked: 'docked' }).success).toBe(false);
  });
  it('accepts bounded whole-pixel dock widths and rejects malformed imported preferences', () => {
    for (const notebookDockWidth of [320, 400, 600]) {
      expect(settingsSchema.parse({ ...DEFAULT_SETTINGS, notebookDockWidth }).notebookDockWidth).toBe(notebookDockWidth);
    }
    for (const notebookDockWidth of [319, 601, 400.5, '400', null, Infinity]) {
      expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, notebookDockWidth }).success).toBe(false);
    }
  });
  it('accepts either side and bounded relative floating positions, with older settings remaining compatible', () => {
    const { notebookDockSide: _side, notebookFloatingPosition: _position, ...legacy } = DEFAULT_SETTINGS;
    expect(settingsSchema.safeParse(legacy).success).toBe(true);
    for (const notebookDockSide of ['left', 'right']) {
      expect(settingsSchema.parse({ ...legacy, notebookDockSide }).notebookDockSide).toBe(notebookDockSide);
    }
    for (const notebookFloatingPosition of [null, { x: 0, y: 1 }, { x: 0.25, y: 0.5 }]) {
      expect(settingsSchema.parse({ ...legacy, notebookFloatingPosition }).notebookFloatingPosition).toEqual(notebookFloatingPosition);
    }
    for (const notebookFloatingPosition of [{ x: -1, y: 0 }, { x: 1.1, y: 0 }, { x: 0, y: Infinity }, { x: '0', y: 1 }, { x: 0 }]) {
      expect(settingsSchema.safeParse({ ...legacy, notebookFloatingPosition }).success).toBe(false);
    }
    expect(settingsSchema.safeParse({ ...legacy, notebookDockSide: 'bottom' }).success).toBe(false);
  });
  it('accepts bounded floating sizes and rejects malformed imported dimensions', () => {
    const { notebookFloatingSize: _size, ...legacy } = DEFAULT_SETTINGS;
    expect(settingsSchema.safeParse(legacy).success).toBe(true);
    for (const notebookFloatingSize of [null, { width: 320, height: 280 }, { width: 480, height: 640 }, { width: 800, height: 1000 }]) {
      expect(settingsSchema.parse({ ...legacy, notebookFloatingSize }).notebookFloatingSize).toEqual(notebookFloatingSize);
    }
    for (const notebookFloatingSize of [{ width: 319, height: 280 }, { width: 801, height: 640 }, { width: 480, height: 279 }, { width: 480, height: 1001 }, { width: 480.5, height: 640 }, { width: '480', height: 640 }, { width: 480, height: Infinity }, { width: 480 }]) {
      expect(settingsSchema.safeParse({ ...legacy, notebookFloatingSize }).success).toBe(false);
    }
  });
});

describe('external resource URL validation', () => {
  it.each(['https://dustloop.com', 'http://localhost:3000/guide'])(
    'accepts %s',
    (url) => {
      expect(externalHttpUrlSchema.safeParse(url).success).toBe(true);
    },
  );

  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://user:secret@example.com',
    'not a URL',
  ])('rejects unsafe URL %s', (url) => {
    expect(characterLinkSchema.safeParse({ id: 'link-1', url, label: 'Guide' }).success).toBe(
      false,
    );
  });
});

describe('cover image adjustment validation', () => {
  it('accepts the supported zoom and pan ranges', () => {
    expect(
      gameSchema.safeParse({
        id: 'game-1',
        name: 'Game',
        buttonLayout: [],
        notationProfile: 'standard',
        coverZoom: 200,
        coverPanX: 0,
        coverPanY: 100,
        ...timestamps,
      }).success,
    ).toBe(true);
  });

  it.each([
    { coverZoom: 99 },
    { coverZoom: 201 },
    { coverPanX: -1 },
    { coverPanY: 101 },
  ])('rejects out-of-range game cover values: %o', (adjustment) => {
    expect(
      gameSchema.safeParse({
        id: 'game-1',
        name: 'Game',
        buttonLayout: [],
        notationProfile: 'standard',
        ...adjustment,
        ...timestamps,
      }).success,
    ).toBe(false);
  });

  it('keeps legacy notation fields at ingestion only', () => {
    const legacyGame = {
      id: 'legacy-game',
      name: 'Legacy Game',
      buttonLayout: [],
      inputType: 'button-numbers' as const,
      ...timestamps,
    };

    expect(legacyGameSchema.safeParse(legacyGame).success).toBe(true);
    expect(gameSchema.safeParse(legacyGame).success).toBe(false);
  });

  it('rejects out-of-range character portrait values', () => {
    expect(
      characterSchema.safeParse({
        id: 'character-1',
        gameId: 'game-1',
        name: 'Character',
        portraitZoom: 250,
        ...timestamps,
      }).success,
    ).toBe(false);
  });
});
