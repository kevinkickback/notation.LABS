// IGDB API module — runs exclusively in the Electron main process.
// All network calls to Twitch/IGDB happen here; results are returned
// to the renderer via IPC as plain data (base64 strings, JSON objects).

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
	console.warn(
		'IGDB integration disabled: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables are required.',
	);
}

const AUTH_URL = 'https://id.twitch.tv/oauth2/token';
const API_URL = 'https://api.igdb.com/v4/games';
const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';

// ---------- Token cache ----------

let accessToken: string | null = null;
let tokenExpiresAt = 0;

function getCredentials(): { clientId: string; clientSecret: string } {
	if (!CLIENT_ID || !CLIENT_SECRET) {
		throw new Error(
			'IGDB credentials not configured: set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables.',
		);
	}
	return { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };
}

async function authenticate(): Promise<string> {
	const { clientId, clientSecret } = getCredentials();

	const now = Date.now();
	if (accessToken && now < tokenExpiresAt) return clientId;

	const params = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'client_credentials',
	});

	const res = await fetch(AUTH_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params.toString(),
	});

	if (!res.ok) {
		throw new Error(`IGDB auth failed: ${res.status} ${res.statusText}`);
	}

	const json = (await res.json()) as {
		access_token: string;
		expires_in: number;
	};

	accessToken = json.access_token;
	// Expire 60 s early to avoid edge-case clock drift
	tokenExpiresAt = now + json.expires_in * 1000 - 60_000;
	return clientId;
}

// ---------- Public API ----------

export interface IGDBSearchResult {
	igdbId: number;
	name: string;
	coverImageId: string | null;
	firstReleaseDate: number | null;
}

/**
 * Search IGDB for games matching `query`.
 * Returns up to 12 base-game results sorted by relevance.
 */
export async function searchGames(query: string): Promise<IGDBSearchResult[]> {
	const clientId = await authenticate();

	// Sanitize: strip characters that could break or inject Apicalypse syntax
	const sanitized = query.replace(/[";]/g, '').trim();
	if (!sanitized) return [];

	const body = [
		`search "${sanitized}";`,
		'fields name, cover.image_id, first_release_date;',
		'where version_parent = null;',
		'limit 12;',
	].join('\n');

	const res = await fetch(API_URL, {
		method: 'POST',
		headers: {
			'Client-ID': clientId,
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'text/plain',
		},
		body,
	});

	if (!res.ok) {
		throw new Error(`IGDB search failed: ${res.status} ${res.statusText}`);
	}

	const data = (await res.json()) as Array<{
		id: number;
		name: string;
		cover?: { image_id: string };
		first_release_date?: number;
	}>;

	return data.map((g) => ({
		igdbId: g.id,
		name: g.name,
		coverImageId: g.cover?.image_id ?? null,
		firstReleaseDate: g.first_release_date ?? null,
	}));
}

/**
 * Download multiple cover thumbnails (90×128) in parallel.
 * Returns a map of imageId → base64 data URL. Failed downloads are omitted.
 */
export async function downloadThumbnails(
	imageIds: string[],
): Promise<Record<string, string>> {
	await authenticate();

	const results: Record<string, string> = {};

	const settled = await Promise.allSettled(
		imageIds.map(async (id) => {
			const url = `${IMAGE_BASE}/t_cover_small/${id}.jpg`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buf = Buffer.from(await res.arrayBuffer());
			return { id, base64: `data:image/jpeg;base64,${buf.toString('base64')}` };
		}),
	);

	for (const result of settled) {
		if (result.status === 'fulfilled') {
			results[result.value.id] = result.value.base64;
		}
	}

	return results;
}

/**
 * Download a single cover at `t_720p` (720×1280) and return it as a
 * base64 data URL — the same format used by the manual file-upload flow.
 */
export async function downloadCover(imageId: string): Promise<string> {
	await authenticate();

	const url = `${IMAGE_BASE}/t_720p/${imageId}.jpg`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Cover download failed: ${res.status} ${res.statusText}`);
	}

	const buf = Buffer.from(await res.arrayBuffer());
	return `data:image/jpeg;base64,${buf.toString('base64')}`;
}
