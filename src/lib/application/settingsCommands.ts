import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { UserSettings } from '@/lib/types';

export function setSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
): Promise<void> {
  return indexedDbStorage.settings.update({ [key]: value });
}

export function getNotesOverrides(): Promise<string[]> {
  return indexedDbStorage.settings.getNotesOverrides();
}

export function setNotesOverride(
  entityId: string,
  isOverride: boolean,
): Promise<void> {
  return indexedDbStorage.settings.setNotesOverride(entityId, isOverride);
}

export function removeNotesOverride(entityId: string): Promise<void> {
  return indexedDbStorage.settings.removeNotesOverride(entityId);
}
