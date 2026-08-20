const DEPLOYED_ENDPOINTS = {
  igdb: 'https://igdb.capitol-k.workers.dev',
  image: 'https://ddg.capitol-k.workers.dev',
} as const;

export function getProviderBase(provider: keyof typeof DEPLOYED_ENDPOINTS) {
  if (import.meta.env.DEV) {
    return provider === 'igdb' ? '/api/igdb' : '/api/image';
  }
  return DEPLOYED_ENDPOINTS[provider];
}
