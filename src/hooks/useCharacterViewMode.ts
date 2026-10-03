import { useState } from 'react';
import { usePersistedCardSize } from '@/hooks/usePersistedCardSize';
import { clampCardSize } from '@/lib/cardGrid';

/**
 * Manages character view mode and card size.
 */
export function useCharacterViewMode(initialCardSize: number) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { cardSize, handleCardSizeChange } = usePersistedCardSize(
    'characterCardSize',
    initialCardSize,
    clampCardSize,
  );

  return {
    viewMode,
    setViewMode,
    cardSize,
    handleCardSizeChange,
  };
}
