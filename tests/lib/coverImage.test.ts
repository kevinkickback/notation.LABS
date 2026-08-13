import { describe, expect, it } from 'vitest';
import {
  getCoverImageSizePercent,
  getDraggedFocalPoint,
} from '@/lib/coverImage';

describe('getCoverImageSizePercent', () => {
  it('expands a landscape image enough to fill a portrait frame', () => {
    expect(getCoverImageSizePercent(3 / 4, 16 / 9, 'fill', 100)).toBeCloseTo(
      237.04,
    );
  });

  it('expands a portrait image enough to fill a landscape frame', () => {
    expect(getCoverImageSizePercent(4 / 3, 3 / 4, 'fill', 100)).toBe(100);
  });

  it('fits the whole image when empty space is allowed', () => {
    expect(getCoverImageSizePercent(4 / 3, 3 / 4, 'free', 100)).toBeCloseTo(
      56.25,
    );
  });

  it('applies zoom relative to the selected fill or free baseline', () => {
    expect(getCoverImageSizePercent(3 / 4, 16 / 9, 'fill', 150)).toBeCloseTo(
      355.56,
    );
    expect(getCoverImageSizePercent(3 / 4, 16 / 9, 'free', 150)).toBe(150);
  });
});

describe('getDraggedFocalPoint', () => {
  it('moves within the image travel and clamps at either edge', () => {
    expect(getDraggedFocalPoint(50, 25, -100)).toBe(25);
    expect(getDraggedFocalPoint(50, -100, -100)).toBe(100);
    expect(getDraggedFocalPoint(50, 100, -100)).toBe(0);
  });

  it('does not move an axis with no available travel', () => {
    expect(getDraggedFocalPoint(35, 50, 0)).toBe(35);
  });
});
