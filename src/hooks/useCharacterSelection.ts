import { useSelection } from '@/hooks/useSelection';

/**
 * Manages multi-select state and operations for characters.
 */
export function useCharacterSelection() {
  return useSelection();
}
