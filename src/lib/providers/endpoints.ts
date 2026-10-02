export const DEPLOYED_ENDPOINTS = {
  igdb: 'https://igdb.capitol-k.workers.dev',
  image: 'https://ddg.capitol-k.workers.dev',
} as const;

export function getProviderBase(provider: keyof typeof DEPLOYED_ENDPOINTS) {
  if (import.meta.env.DEV) {
    // IGDB allows the hosted demo's origin; development needs a same-origin proxy.
    if (provider === 'igdb') return '/api/igdb';
    if (import.meta.env.VITE_USE_LOCAL_PROVIDERS === 'true')
      return '/api/image';
  }
  return DEPLOYED_ENDPOINTS[provider];
}
