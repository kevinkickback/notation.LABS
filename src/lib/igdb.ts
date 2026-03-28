// src/lib/igdb.ts
import { getApiBase } from './utils';

export interface RawIGDBApiResult {
	id: number;
	name: string;
	coverImageId?: string;
	cover?: { image_id?: string };
	firstReleaseDate?: number;
	first_release_date?: number;
}

export async function searchIGDB(query: string): Promise<RawIGDBApiResult[]> {
	const res = await fetch(getApiBase('igdb'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query }),
	});
	if (!res.ok) throw new Error(`IGDB search failed: ${res.status}`);
	return res.json();
}
