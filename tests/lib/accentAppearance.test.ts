import { describe, expect, it } from 'vitest';
import { getAccentAppearance } from '@/lib/accentAppearance';

describe('accent appearance', () => {
  it.each([
    ['#3b82f6', '#000', '#3b82f6'], ['#e14c9b', '#000', '#e14c9b'], ['#ffffff', '#000', '#ffffff'],
    ['#000000', '#fff', '#000000'], ['#123456', '#fff', '#123456'], ['#777777', '#000', '#777777'],
    ['#ff0000', '#000', '#ff0000'], ['#00ff00', '#000', '#00ff00'], ['#0000ff', '#fff', '#0000ff'],
    ['#fff', '#000', '#ffffff'], ['#000', '#fff', '#000000'], ['#ABC', '#000', '#aabbcc'],
  ])('normalizes %s and chooses %s text', (color, foreground, background) => {
    expect(getAccentAppearance(color)).toEqual({ background, foreground });
  });

  it('uses the default accent for missing or invalid saved choices', () => {
    for (const color of [undefined, '', '   ', 'not a color']) {
      expect(getAccentAppearance(color)).toEqual({ background: '#3b82f6', foreground: '#000' });
    }
  });
});
