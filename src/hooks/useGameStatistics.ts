import { useLiveQuery } from 'dexie-react-hooks';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

export function useGameStatistics() {
  return useLiveQuery(indexedDbStorage.gameStats.getInputs, []);
}
