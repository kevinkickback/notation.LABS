// DuckDuckGo image search module — runs in the Electron main process.
// Used to find character images for fighting game characters.
// No API keys required.

export interface ImageSearchResult {
	title: string;
	thumbnailUrl: string;
	imageUrl: string;
	width: number;
	height: number;
}

/**
 * Search DuckDuckGo for images matching `query`.
 * Returns up to 12 results.
 */
export async function searchImages(
	query: string,
): Promise<ImageSearchResult[]> {
	const sanitized = query.trim();
	if (!sanitized) return [];

	// Step 1: Get a vqd token from DuckDuckGo
	const tokenRes = await fetch(
		`https://duckduckgo.com/?q=${encodeURIComponent(sanitized)}&iax=images&ia=images`,
		{
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			},
		},
	);

	if (!tokenRes.ok) {
		throw new Error(`Failed to get search token: ${tokenRes.status}`);
	}

	const html = await tokenRes.text();
	const vqdMatch = html.match(/vqd=["']([^"']+)["']/);
	if (!vqdMatch) {
		throw new Error('Could not extract search token');
	}
	const vqd = vqdMatch[1];

	// Step 2: Fetch image results
	const searchUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(sanitized)}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1`;

	const searchRes = await fetch(searchUrl, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			Referer: 'https://duckduckgo.com/',
		},
	});

	if (!searchRes.ok) {
		throw new Error(`Image search failed: ${searchRes.status}`);
	}

	const data = (await searchRes.json()) as {
		results: Array<{
			title: string;
			thumbnail: string;
			image: string;
			width: number;
			height: number;
		}>;
	};

	if (!data.results) return [];

	return data.results.slice(0, 12).map((r) => ({
		title: r.title,
		thumbnailUrl: r.thumbnail,
		imageUrl: r.image,
		width: r.width,
		height: r.height,
	}));
}

/**
 * Download multiple image thumbnails in parallel and return as base64.
 * Keys are the original URLs; values are base64 data URLs.
 */
export async function downloadImageThumbnails(
	urls: string[],
): Promise<Record<string, string>> {
	const results: Record<string, string> = {};

	const settled = await Promise.allSettled(
		urls.map(async (url) => {
			const res = await fetch(url, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				},
				signal: AbortSignal.timeout(8000),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const contentType = res.headers.get('content-type') || 'image/jpeg';
			const mimeType = contentType.split(';')[0].trim();
			const buf = Buffer.from(await res.arrayBuffer());
			return {
				url,
				base64: `data:${mimeType};base64,${buf.toString('base64')}`,
			};
		}),
	);

	for (const result of settled) {
		if (result.status === 'fulfilled') {
			results[result.value.url] = result.value.base64;
		}
	}

	return results;
}

/**
 * Download a full-size image from a URL and return as base64 data URL.
 */
export async function downloadFullImage(url: string): Promise<string> {
	const res = await fetch(url, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!res.ok) {
		throw new Error(`Image download failed: ${res.status} ${res.statusText}`);
	}

	const contentType = res.headers.get('content-type') || 'image/jpeg';
	const mimeType = contentType.split(';')[0].trim();
	const buf = Buffer.from(await res.arrayBuffer());
	return `data:${mimeType};base64,${buf.toString('base64')}`;
}
