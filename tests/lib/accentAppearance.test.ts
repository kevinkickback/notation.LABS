import { describe, expect, it } from 'vitest';
import { getAccentAppearance } from '@/lib/accentAppearance';

describe('accent appearance', () => {
  it.each([
    ['#3b82f6', '#000'], ['#e14c9b', '#000'], ['#ffffff', '#000'],
    ['#000000', '#fff'], ['#123456', '#fff'], ['#777777', '#000'],
    ['#ff0000', '#000'], ['#00ff00', '#000'], ['#0000ff', '#fff'],
    ['#fff', '#000'], ['#000', '#fff'], ['#ABC', '#000'],
  ])('keeps %s and chooses %s text', (color, foreground) => {
    const background = color.length === 4
      ? `#${[...color.slice(1)].map(channel => channel.repeat(2)).join('').toLowerCase()}`
      : color;
    expect(getAccentAppearance(color)).toEqual({ background, foreground });
  });

  it('uses the default accent for missing or invalid saved choices', () => {
    for (const color of [undefined, '', '   ', 'not a color']) {
      expect(getAccentAppearance(color)).toEqual({ background: '#3b82f6', foreground: '#000' });
    }
  });
});
