import { describe, expect, it } from 'vitest';
import {
  getMechanicAccessibilityLabel,
  migrateLegacyNotationProfile,
  resolveNotationProfile,
} from '@/lib/notationProfiles';
import type { Game } from '@/lib/types';

function legacyGame(inputType: Game['inputType']): Game {
  return {
    id: `legacy-${inputType}`,
    name: 'Legacy Game',
    inputType,
    buttonLayout: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('notation profiles', () => {
  it.each([
    ['numpad', 'standard'],
    ['button-numbers', 'tekken'],
  ] as const)('migrates legacy %s games to %s', (inputType, expectedProfile) => {
    const game = legacyGame(inputType);

    migrateLegacyNotationProfile(game);

    expect(game.notationProfile).toBe(expectedProfile);
    expect(game.inputType).toBeUndefined();
  });

  it('prefers an explicit current profile over a legacy input type', () => {
    expect(
      resolveNotationProfile({
        notationProfile: 'nrs',
        inputType: 'button-numbers',
      }),
    ).toBe('nrs');
  });

  it('provides accessible meanings for standardized Tekken mechanics', () => {
    expect(getMechanicAccessibilityLabel('tekken', 'S!')).toBe(
      'S!, Screw attack',
    );
    expect(getMechanicAccessibilityLabel('tekken', '*(max)')).toBe(
      '*(max), Hold the preceding button to maximum level',
    );
    expect(getMechanicAccessibilityLabel('nrs', 'AMP')).toBe(
      'AMP, Amplified move',
    );
  });
});
