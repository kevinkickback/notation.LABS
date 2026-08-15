import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Character } from '@/lib/types';

export type CreateCharacterInput = Omit<
  Character,
  'id' | 'createdAt' | 'updatedAt'
>;
export type UpdateCharacterInput = Partial<
  Omit<CreateCharacterInput, 'gameId'>
>;

export function createCharacter(input: CreateCharacterInput): Promise<string> {
  return indexedDbStorage.characters.add(input);
}

export function updateCharacter(
  characterId: string,
  updates: UpdateCharacterInput,
): Promise<void> {
  return indexedDbStorage.characters.update(characterId, updates);
}

export function deleteCharacter(characterId: string): Promise<void> {
  return indexedDbStorage.characters.delete(characterId);
}

export function deleteCharacters(characterIds: string[]): Promise<void> {
  return indexedDbStorage.characters.bulkDelete(characterIds);
}
