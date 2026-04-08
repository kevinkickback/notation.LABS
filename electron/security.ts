const ALLOWED_EXTERNAL_HOSTS = new Set([
  'github.com',
  'www.github.com',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'kevinkickback.com',
  'www.kevinkickback.com',
  'dustloop.com',
  'www.dustloop.com',
  'wiki.gbl.gg',
  'wiki.supercombo.gg',
  'glossary.infil.net',
  'reddit.com',
  'www.reddit.com',
]);

function parseExternalUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isPromptEligibleExternalUrl(parsedUrl: URL): boolean {
  if (parsedUrl.protocol !== 'https:') {
    return false;
  }

  if (parsedUrl.username || parsedUrl.password) {
    return false;
  }

  return true;
}

export function isSafeExternalUrl(url: string): boolean {
  const parsedUrl = parseExternalUrl(url);
  if (!parsedUrl || !isPromptEligibleExternalUrl(parsedUrl)) {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  return ALLOWED_EXTERNAL_HOSTS.has(hostname);
}

export function isPromptableExternalUrl(url: string): boolean {
  const parsedUrl = parseExternalUrl(url);
  if (!parsedUrl || !isPromptEligibleExternalUrl(parsedUrl)) {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  return !ALLOWED_EXTERNAL_HOSTS.has(hostname);
}
