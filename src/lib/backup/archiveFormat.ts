import { z } from 'zod';
import { isImageDataUrl } from '@/lib/media/images';
import {
  characterSchema,
  comboSchema,
  gameSchema,
  settingsSchema,
  videoHeaderSchema,
} from '@/lib/schemas';
import type { Character, Game } from '@/lib/types';

const sizeSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const archiveManifestSchema = z.object({
  version: z.literal(4),
  exported: z.string(),
  counts: z.object({
    games: sizeSchema,
    characters: sizeSchema,
    combos: sizeSchema,
    videos: sizeSchema,
  }),
  settings: settingsSchema.optional(),
});
export const archiveImageSchema = z.object({
  path: z.string().regex(/^images\/[gc]-\d+\.bin$/),
  mimeType: z.enum([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
  ]),
});
export const archiveGameSchema = gameSchema.extend({
  image: archiveImageSchema.optional(),
});
export const archiveCharacterSchema = characterSchema.extend({
  image: archiveImageSchema.optional(),
});
export const archiveComboSchema = comboSchema;
export const archiveVideoSchema = videoHeaderSchema.extend({
  path: z.string().regex(/^videos\/v-\d+\.bin$/),
  size: sizeSchema,
});
export type ArchiveVideo = z.infer<typeof archiveVideoSchema>;

export function separateImage<T extends Game | Character>(
  record: T,
  path: string,
) {
  const source =
    'logoImage' in record
      ? record.logoImage
      : 'portraitImage' in record
        ? record.portraitImage
        : undefined;
  if (!isImageDataUrl(source)) return { record, blob: undefined };
  const comma = source.indexOf(',');
  const mimeType = source.slice(5, source.indexOf(';'));
  const bytes = Uint8Array.from(atob(source.slice(comma + 1)), (char) =>
    char.charCodeAt(0),
  );
  const image = archiveImageSchema.parse({ path, mimeType });
  const wire = {
    ...record,
    logoImage: undefined,
    portraitImage: undefined,
    image,
  };
  return { record: wire, blob: new Blob([bytes], { type: mimeType }) };
}

export function imageDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  const url = `data:${mimeType};base64,${btoa(binary)}`;
  if (!isImageDataUrl(url))
    throw new Error('Backup contains an unsupported or invalid image');
  return url;
}
