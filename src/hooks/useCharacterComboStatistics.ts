import { useLiveQuery } from 'dexie-react-hooks';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

export function useCharacterComboStatistics(characterIds: string[]) {
  const characterIdsKey = characterIds.join('\0');

  return useLiveQuery(
    () => indexedDbStorage.combos.getByCharacters(characterIds),
    [characterIdsKey],
  );
}
