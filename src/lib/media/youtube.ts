export function extractYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null;
    const parts = url.pathname.split('/').filter(Boolean);
    let id: string | null = null;
    if (
      ['youtu.be', 'www.youtu.be'].includes(url.hostname) &&
      parts.length === 1
    )
      id = parts[0];
    if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
      ].includes(url.hostname)
    ) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (
        parts.length === 2 &&
        ['embed', 'shorts', 'live'].includes(parts[0])
      )
        id = parts[1];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = extractYouTubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : null;
}

export async function fetchYouTubeTitle(
  url: string,
  signal: AbortSignal,
): Promise<string> {
  const id = extractYouTubeVideoId(url);
  if (!id) return '';
  try {
    const canonicalUrl = `https://www.youtube.com/watch?v=${id}`;
    const response = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(canonicalUrl)}`,
      { signal },
    );
    if (!response.ok) return '';
    const data: unknown = await response.json();
    signal.throwIfAborted();
    if (
      typeof data === 'object' &&
      data !== null &&
      'title' in data &&
      typeof data.title === 'string'
    )
      return data.title;
    return '';
  } catch (error) {
    if (signal.aborted) throw error;
    return '';
  }
}
