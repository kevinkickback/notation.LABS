import { describe, expect, it } from 'vitest';
import {
  compareEntityNames,
  compareFavoritesFirst,
} from '@/lib/entitySorting';

describe('entity sorting', () => {
  const entries = [
    { name: 'Fighter 10' },
    { name: 'alpha' },
    { name: 'Fighter 2' },
  ];

  it('sorts names alphabetically with case-insensitive numeric ordering', () => {
    expect([...entries].sort(compareEntityNames).map((entry) => entry.name)).toEqual([
      'alpha',
      'Fighter 2',
      'Fighter 10',
    ]);
  });

  it('groups favorites first', () => {
    const favorite = { favorite: true };
    const regular = { favorite: false };

    expect(compareFavoritesFirst(favorite, regular)).toBeLessThan(0);
    expect(compareFavoritesFirst(regular, favorite)).toBeGreaterThan(0);
  });
});
