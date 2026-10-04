import { describe, expect, it } from 'vitest';
import { getCardGridLayout } from '@/lib/cardGrid';

describe('flexible card grid choices', () => {
  it.each([1, 4 / 3])('keeps only distinct layouts at scale %s', scale => {
    for (const width of [250, 600, 997, 1200, 1600]) {
      const layout = getCardGridLayout(width, 16, 180, scale);
      const choices = layout.sizes.map(size => getCardGridLayout(width, 16, size, scale));
      expect(new Set(choices.map(choice => choice.columns)).size).toBe(choices.length);
      for (let index = 0; index < choices.length; index++) {
        const choice = choices[index];
        expect(choice.width * choice.columns + (choice.columns - 1) * 16).toBeCloseTo(width);
        if (index > 0) expect(choice.width).toBeGreaterThan(choices[index - 1].width);
      }
      expect(choices[layout.index].columns).toBe(layout.columns);
    }
  });
  it('maps old preferences to their existing layout without rewriting them', () => {
    const layout = getCardGridLayout(997, 16, 190);
    expect(layout.columns).toBe(4);
    expect(layout.width).toBe(237.25);
    expect(getCardGridLayout(997, 16, layout.sizes[layout.index]).columns).toBe(4);
    expect(layout.sizes[layout.sizes.length - 1]).toBe(300);
  });
  it('offers one layout when two minimum cards cannot fit', () => {
    expect(getCardGridLayout(200, 16, 300)).toEqual({ sizes: [120], index: 0, columns: 1, width: 200 });
    expect(getCardGridLayout(0, 0, 180).width).toBe(0);
  });
  it('matches fractional game minima and rounded character minima', () => {
    expect(getCardGridLayout(769, 16, 180.4).columns).toBe(3);
    expect(getCardGridLayout(769, 16, 180).columns).toBe(4);
    expect(getCardGridLayout(769, 16, 180.4, 4 / 3).columns).toBe(3);
  });
});
