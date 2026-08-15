import { describe, expect, it } from 'vitest';
import { normalizeBackupImport } from '@/lib/backup/importPipeline';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { BackupImportData } from '@/lib/types';

const baseImport: BackupImportData = {
  version: 1,
  exported: new Date(0).toISOString(),
  games: [
    {
      id: 'game-1',
      name: 'Legacy Game',
      buttonLayout: ['1', '2'],
      inputType: 'button-numbers',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  characters: [
    {
      id: 'character-1',
      gameId: 'game-1',
      name: 'Fighter',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  combos: [
    {
      id: 'combo-1',
      characterId: 'character-1',
      name: 'Combo',
      notation: '1',
      parsedNotation: [],
      tags: [],
      demoUrl: 'local:missing-video',
      demoFileName: 'missing.mp4',
      demoVideoTitle: 'Missing',
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  settings: DEFAULT_SETTINGS,
};

describe('normalizeBackupImport', () => {
  it('normalizes legacy games and sanitizes unavailable videos', () => {
    const plan = normalizeBackupImport(baseImport, {
      includeSettings: false,
      videos: [],
    });

    expect(plan.games[0].notationProfile).toBe('tekken');
    expect(plan.games[0]).not.toHaveProperty('inputType');
    expect(plan.combos[0].demoUrl).toBeUndefined();
    expect(plan.combos[0].demoFileName).toBeUndefined();
    expect(plan.settings).toBeUndefined();
  });

  it('retains available video references and selected settings', () => {
    const plan = normalizeBackupImport(baseImport, {
      includeSettings: true,
      videos: [
        {
          id: 'missing-video',
          fileName: 'available.mp4',
          mimeType: 'video/mp4',
          data: new ArrayBuffer(1),
        },
      ],
    });

    expect(plan.combos[0].demoUrl).toBe('local:missing-video');
    expect(plan.settings).toEqual(DEFAULT_SETTINGS);
    expect(plan.videos).toHaveLength(1);
  });

  it('rejects orphaned records before application', () => {
    expect(() =>
      normalizeBackupImport(
        {
          ...baseImport,
          games: [],
        },
        { includeSettings: false, videos: [] },
      ),
    ).toThrow(
      'Import has referential integrity issues: 1 orphaned characters, 0 orphaned combos',
    );
  });
});