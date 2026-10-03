import { DEFAULT_SETTINGS } from '@/lib/defaults';

const DEFAULT_ACCENT = DEFAULT_SETTINGS.accentColor ?? '#3b82f6';

export function getAccentAppearance(value?: string): {
  background: string;
  foreground: '#000' | '#fff';
} {
  let color = value?.trim() || DEFAULT_ACCENT;
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) {
    if (globalThis.CSS?.supports?.('color', color)) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = DEFAULT_ACCENT;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const pixel = context.getImageData(0, 0, 1, 1).data;
        // Opaque sRGB accents keep contrast independent of the surface underneath.
        color =
          pixel[3] === 0
            ? DEFAULT_ACCENT
            : `#${[...pixel]
                .slice(0, 3)
                .map((channel) => channel.toString(16).padStart(2, '0'))
                .join('')}`;
      } else color = DEFAULT_ACCENT;
    } else color = DEFAULT_ACCENT;
  }
  const hex =
    color.length === 4
      ? [...color.slice(1)].map((channel) => channel.repeat(2)).join('')
      : color.slice(1);
  // WCAG contrast uses linear sRGB luminance, rather than perceived brightness.
  const linear = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return {
    background: `#${hex.toLowerCase()}`,
    foreground: whiteContrast >= blackContrast ? '#fff' : '#000',
  };
}
