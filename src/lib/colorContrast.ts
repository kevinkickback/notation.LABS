/** Keep the chosen hue while bringing text and icon colors into the theme's readable range. */
export function readableColor(color: string): string {
  return `oklch(from ${color} clamp(var(--readable-color-min), l, var(--readable-color-max)) c h)`;
}
