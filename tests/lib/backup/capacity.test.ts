import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageWarning } from '@/lib/backup/capacity';
afterEach(() => vi.unstubAllGlobals());
describe('advisory backup storage estimates', () => {
  it('includes the existing library when estimating staged storage', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 1000, usage: 700 }) } });
    expect(await storageWarning(250)).toBeUndefined();
    expect(await storageWarning(350)).toMatch(/nearly full/);
  });
  it('does not reject transfers when the platform cannot estimate space', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => { throw new Error('unavailable'); } } });
    expect(await storageWarning(1024 ** 3)).toBeUndefined();
  });
});
