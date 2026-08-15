import { useState } from 'react';
import { usePersistedCardSize } from '@/hooks/usePersistedCardSize';

/**
 * Manages game view mode (grid/list) and card size
 */
export function useGameViewMode(initialCardSize: number) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { cardSize, handleCardSizeChange } = usePersistedCardSize(
    'gameCardSize',
    initialCardSize,
  );

  return {
    viewMode,
    setViewMode,
    cardSize,
    handleCardSizeChange,
  };
}
