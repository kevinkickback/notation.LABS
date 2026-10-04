import type { Locator } from '@playwright/test';

export async function textContrast(
  control: Locator,
  property: 'color' | 'borderTopColor' | 'outlineColor' = 'color',
  surroundingSurface = false,
): Promise<number> {
  return control.evaluate((element, { property, surroundingSurface }) => {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Cannot measure text contrast');
    const luminance = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const pixels = context.getImageData(0, 0, 1, 1).data;
      if (pixels[3] !== 255) throw new Error(`Contrast measurement needs an opaque color: ${color}`);
      const channels = Array.from(pixels).slice(0, 3).map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const style = getComputedStyle(element);
    const foreground = luminance(style[property]);
    let surface: Element | null = surroundingSurface ? element.parentElement : element;
    let backgroundColor = surface ? getComputedStyle(surface).backgroundColor : style.backgroundColor;
    while (surface && (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent')) {
      surface = surface.parentElement;
      if (surface) backgroundColor = getComputedStyle(surface).backgroundColor;
    }
    const background = luminance(backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  }, { property, surroundingSurface });
}

/** Covers notation's short labels/symbols and tinted SVG shapes that axe cannot measure. */
export async function notationContrast(surface: Locator) {
  return surface.evaluate(root => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot measure notation contrast');
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const blend = (color: number[], background: number[], alpha = color[3] / 255) =>
      color.slice(0, 3).map((channel, index) => channel * alpha + background[index] * (1 - alpha));
    const backgroundOf = (element: Element): number[] => {
      const parent = element.parentElement ? backgroundOf(element.parentElement) : [255, 255, 255];
      return blend(rgba(getComputedStyle(element).backgroundColor), parent);
    };
    const luminance = (rgb: number[]) => {
      const channels = rgb.map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    return Array.from(root.querySelectorAll('span[style], sup[style], svg text')).filter(element =>
      element.textContent?.trim() && element.children.length === 0,
    ).map(element => {
      let background = backgroundOf(element);
      const style = getComputedStyle(element);
      const isSvgText = element.tagName === 'text';
      if (isSvgText) {
        const shape = element.closest('svg')?.querySelector('circle, rect, path, polygon');
        if (shape) {
          const shapeStyle = getComputedStyle(shape);
          background = blend(rgba(shapeStyle.fill), background, Number(shapeStyle.opacity));
        }
      }
      const foreground = blend(rgba(isSvgText ? style.fill : style.color), background, Number(style.opacity));
      const a = luminance(foreground), b = luminance(background);
      return { text: element.textContent, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });
}
