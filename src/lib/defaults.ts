import type { UserSettings, FontFamily } from './types';

export const MAX_IMPORT_SIZE_BYTES = 50 * 1024 * 1024;

export const DEFAULT_BUTTON_PALETTE = [
  '#e53e3e',
  '#dd6b20',
  '#d69e2e',
  '#38a169',
  '#319795',
  '#3182ce',
  '#5a67d8',
  '#805ad5',
  '#d53f8c',
  '#718096',
];

export const FONT_OPTIONS: {
  value: FontFamily;
  label: string;
  style: string;
}[] = [
  {
    value: 'system-ui',
    label: 'System Default',
    style: 'system-ui, -apple-system, sans-serif',
  },
  {
    value: 'jetbrains-mono',
    label: 'JetBrains Mono',
    style: '"JetBrains Mono", monospace',
  },
  { value: 'verdana', label: 'Verdana', style: 'Verdana, Geneva, sans-serif' },
  {
    value: 'space-grotesk',
    label: 'Space Grotesk',
    style: '"Space Grotesk", sans-serif',
  },
];

export function getFontFamilyCSS(fontFamily: FontFamily): string {
  return (
    FONT_OPTIONS.find((f) => f.value === fontFamily)?.style ??
    FONT_OPTIONS[0].style
  );
}

export const DEFAULT_SETTINGS: UserSettings = {
  colorTheme: 'dark',
  fontFamily: 'system-ui',
  notationColors: {
    // #bdceef = oklch(0.85 0.05 265), #6c727e = oklch(0.55 0.02 265)
    direction: '#bdceef',
    separator: '#6c727e',
  },
  displayMode: 'colored-text',
  iconStyle: 'round',
  uiTheme: 'default',
  comboScale: 1,
  autoUpdate: true,
  confirmBeforeDelete: true,
  videoPlayerSize: 'lg',
  gameCardSize: 180,
  characterCardSize: 180,
  notesDefaultOpen: false,
  showChangelogBeforeUpdate: true,
  accentColor: '#3b82f6',
};
