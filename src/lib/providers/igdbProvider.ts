import { z } from 'zod';
import type { IGDBSearchResult } from '@/lib/types';
import { fetchImageAsBase64 } from '@/lib/utils';
import { getProviderBase } from './endpoints';

const rawIgdbResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  coverImageId: z.string().optional(),
  cover: z.object({ image_id: z.string().optional() }).optional(),
  firstReleaseDate: z.number().optional(),
  first_release_date: z.number().optional(),
});

export async function searchIgdbGames(
  query: string,
  signal?: AbortSignal,
): Promise<IGDBSearchResult[]> {
  const response = await fetch(getProviderBase('igdb'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) throw new Error(`IGDB search failed: ${response.status}`);

  let rawData: unknown;
  try {
    rawData = await response.json();
  } catch {
    throw new Error('IGDB search failed: invalid JSON response');
  }
  const parsed = z.array(rawIgdbResultSchema).safeParse(rawData);
  if (!parsed.success) {
    throw new Error('IGDB search failed: invalid response shape');
  }
  return parsed.data.map((game) => ({
    igdbId: game.id,
    name: game.name,
    coverImageId: game.coverImageId ?? game.cover?.image_id ?? null,
    firstReleaseDate: game.firstReleaseDate ?? game.first_release_date ?? null,
  }));
}

export function getIgdbCoverUrl(coverImageId: string, size: string) {
  return `https://images.igdb.com/igdb/image/upload/${size}/${coverImageId}.jpg`;
}

export async function downloadIgdbCover(
  coverImageId: string,
): Promise<string | null> {
  for (const size of [
    't_cover_big_2x',
    't_cover_big',
    't_cover_small_2x',
    't_cover_small',
    't_thumb',
  ]) {
    const dataUrl = await fetchImageAsBase64(
      `${getProviderBase('igdb')}/download`,
      getIgdbCoverUrl(coverImageId, size),
    );
    if (dataUrl) return dataUrl;
  }
  return null;
}
