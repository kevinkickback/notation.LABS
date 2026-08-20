import { useState } from 'react';
import { usePersistedCardSize } from '@/hooks/usePersistedCardSize';

const clampCharSize = (v: number) => Math.min(300, Math.max(120, v));

/**
 * Manages character view mode and card size.
 */
export function useCharacterViewMode(initialCardSize: number) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { cardSize, handleCardSizeChange } = usePersistedCardSize(
    'characterCardSize',
    initialCardSize,
    clampCharSize,
  );

  return {
    viewMode,
    setViewMode,
    cardSize,
    handleCardSizeChange,
  };
}
