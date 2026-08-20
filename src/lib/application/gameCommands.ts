import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Game } from '@/lib/types';

export type CreateGameInput = Omit<Game, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateGameInput = Partial<CreateGameInput>;

export function getGames(): Promise<Game[]> {
  return indexedDbStorage.games.getAll();
}

export function createGame(input: CreateGameInput): Promise<string> {
  return indexedDbStorage.games.add(input);
}

export function updateGame(
  gameId: string,
  updates: UpdateGameInput,
): Promise<void> {
  return indexedDbStorage.games.update(gameId, updates);
}

export function setGameFavorite(
  gameId: string,
  favorite: boolean,
): Promise<void> {
  return indexedDbStorage.games.setFavorite(gameId, favorite);
}

export function deleteGame(gameId: string): Promise<void> {
  return indexedDbStorage.games.delete(gameId);
}

export function deleteGames(gameIds: string[]): Promise<void> {
  return indexedDbStorage.games.bulkDelete(gameIds);
}
