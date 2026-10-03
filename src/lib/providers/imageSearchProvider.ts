import { z } from 'zod';
import { fetchImageAsBase64 } from '@/lib/media/images';
import { externalHttpUrlSchema } from '@/lib/schemas';
import type { ImageSearchResult } from '@/lib/types';
import { getProviderBase } from './endpoints';

const imageSearchResultSchema = z.object({
  title: z.string(),
  thumbnailUrl: z.union([z.literal(''), externalHttpUrlSchema]),
  imageUrl: externalHttpUrlSchema,
  width: z.number(),
  height: z.number(),
});

export async function searchCharacterImages(
  query: string,
  signal?: AbortSignal,
): Promise<ImageSearchResult[]> {
  const response = await fetch(`${getProviderBase('image')}/image-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) throw new Error(`Image search failed: ${response.status}`);

  const parsed = imageSearchResultSchema
    .array()
    .safeParse(await response.json());
  if (!parsed.success) throw new Error('Invalid image search response');
  return parsed.data;
}

export function downloadCharacterImage(imageUrl: string, signal?: AbortSignal) {
  return fetchImageAsBase64(
    `${getProviderBase('image')}/download`,
    imageUrl,
    signal,
  );
}
