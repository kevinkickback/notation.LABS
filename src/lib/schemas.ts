import { z } from 'zod';

export const comboTokenSchema = z.object({
  type: z.enum([
    'direction',
    'motion',
    'button',
    'separator',
    'modifier',
    'repeat-start',
    'repeat-end',
    'unknown',
  ]),
  value: z.string(),
  rawValue: z.string(),
  repeatCount: z.number().optional(),
  repeatLabel: z.string().optional(),
});

export const gameSchema = z.object({
  id: z.string(),
  name: z.string(),
  logoImage: z.string().optional(),
  coverZoom: z.number().optional(),
  coverPanX: z.number().optional(),
  coverPanY: z.number().optional(),
  buttonLayout: z.array(z.string()),
  buttonColors: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const characterSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  name: z.string(),
  portraitImage: z.string().optional(),
  portraitZoom: z.number().optional(),
  portraitPanX: z.number().optional(),
  portraitPanY: z.number().optional(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const comboSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  name: z.string(),
  notation: z.string(),
  parsedNotation: z.array(comboTokenSchema),
  description: z.string().optional(),
  difficulty: z.number().optional(),
  damage: z.string().optional(),
  meterCost: z.string().optional(),
  tags: z.array(z.string()),
  demoUrl: z.string().optional(),
  demoFileName: z.string().optional(),
  demoVideoTitle: z.string().optional(),
  notes: z.string().optional(),
  outdated: z.boolean().optional(),
  sortOrder: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const settingsSchema = z.object({
  colorTheme: z.enum(['light', 'dark']),
  fontFamily: z.enum([
    'system-ui',
    'jetbrains-mono',
    'verdana',
    'space-grotesk',
  ]),
  notationColors: z
    .object({
      direction: z.string(),
      separator: z.string(),
    })
    .catchall(z.string()),
  displayMode: z.enum(['colored-text', 'visual-icons']),
  iconStyle: z.enum(['round', 'square', 'hexagon']),
  uiTheme: z.string(),
  comboScale: z.number(),
  autoUpdate: z.boolean(),
  confirmBeforeDelete: z.boolean(),
  videoPlayerSize: z.enum(['sm', 'md', 'lg', 'xl']),
  gameCardSize: z.number(),
  characterCardSize: z.number(),
  notesDefaultOpen: z.boolean().default(false),
  notesOverrides: z.array(z.string()).optional(),
  parsedNotationVersion: z.number().int().nonnegative().default(0),
  lastUpdateCheck: z.number().optional(),
  lastSeenVersion: z.string().optional(),
  showChangelogBeforeUpdate: z.boolean(),
  accentColor: z.string().optional(),
});

const demoVideoSchema = z
  .object({
    id: z.string(),
    fileName: z.string(),
    mimeType: z.string(),
    dataBase64: z.string().optional(),
    path: z.string().optional(),
  })
  .refine((video) => Boolean(video.dataBase64 || video.path), {
    message: 'Each demo video must include either dataBase64 or path',
  });

export const importDataSchema = z.object({
  version: z.number().int().min(1).max(3),
  exported: z.string(),
  games: z.array(gameSchema).optional(),
  characters: z.array(characterSchema).optional(),
  combos: z.array(comboSchema).optional(),
  settings: settingsSchema.optional(),
  demoVideos: z.array(demoVideoSchema).optional(),
});

// Derived TypeScript types — single source of truth
export type ComboToken = z.infer<typeof comboTokenSchema>;
export type TokenType = ComboToken['type'];
export type Game = z.infer<typeof gameSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Combo = z.infer<typeof comboSchema>;
export type UserSettings = z.infer<typeof settingsSchema>;
export type NotationColors = UserSettings['notationColors'];
export type FontFamily = UserSettings['fontFamily'];
export type DisplayMode = UserSettings['displayMode'];
export type IconStyle = UserSettings['iconStyle'];
