import { getApiBase } from './utils';

export interface RawIGDBApiResult {
  id: number;
  name: string;
  coverImageId?: string;
  cover?: { image_id?: string };
  firstReleaseDate?: number;
  first_release_date?: number;
}

export async function searchIGDB(
  query: string,
  signal?: AbortSignal,
): Promise<RawIGDBApiResult[]> {
  const res = await fetch(getApiBase('igdb'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!res.ok) throw new Error(`IGDB search failed: ${res.status}`);
  try {
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('IGDB search failed: invalid response shape');
    }
    return data as RawIGDBApiResult[];
  } catch {
    throw new Error('IGDB search failed: invalid JSON response');
  }
}
