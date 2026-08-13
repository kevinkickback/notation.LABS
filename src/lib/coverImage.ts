import type { CoverImageFit } from './types';

const clampPercentage = (value: number) => Math.min(100, Math.max(0, value));

export function getCoverImageSizePercent(
  frameAspect: number,
  imageAspect: number,
  fit: CoverImageFit,
  zoom: number,
) {
  if (frameAspect <= 0 || imageAspect <= 0) return zoom;

  const widthRatio = imageAspect / frameAspect;
  const baseSize =
    fit === 'fill' ? Math.max(1, widthRatio) : Math.min(1, widthRatio);

  return baseSize * zoom;
}

export function getDraggedFocalPoint(
  start: number,
  pointerDelta: number,
  imageTravel: number,
) {
  if (Math.abs(imageTravel) < 0.5) return start;
  return clampPercentage(start + (pointerDelta / imageTravel) * 100);
}
