import { describe, expect, it } from 'vitest';
import {
  characterLinkSchema,
  characterSchema,
  externalHttpUrlSchema,
  gameSchema,
  legacyGameSchema,
} from '@/lib/schemas';

const timestamps = { createdAt: 1, updatedAt: 1 };

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
