/**
 * Fetches an image from a remote worker and returns a base64 data URL.
 * @param workerUrl The worker endpoint (e.g., https://igdb.capitol-k.workers.dev/download)
 * @param imageUrl The image URL to download
 * @returns The base64 data URL, or null if failed
 */
export async function fetchImageAsBase64(
	workerUrl: string,
	imageUrl: string,
): Promise<string | null> {
	try {
		const res = await fetch(workerUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: imageUrl }),
		});
		if (!res.ok) return null;
		const json = await res.json();
		return json.dataUrl || null;
	} catch {
		return null;
	}
}
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getApiBase(type: 'igdb' | 'ddg'): string {
	if (type === 'igdb') {
		return 'https://igdb.capitol-k.workers.dev';
	}
	if (type === 'ddg') {
		return 'https://ddg.capitol-k.workers.dev';
	}
	return '';
}
