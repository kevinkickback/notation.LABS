import { useEffect, useState } from 'react';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

/**
 * Manages game view mode (grid/list) and card size
 */
export function useGameViewMode(initialCardSize: number) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cardSize, setCardSize] = useState(initialCardSize);

  useEffect(() => {
    setCardSize(initialCardSize);
  }, [initialCardSize]);

  const handleCardSizeChange = async (size: number) => {
    setCardSize(size);
    await indexedDbStorage.settings.update({ gameCardSize: size });
  };

  return {
    viewMode,
    setViewMode,
    cardSize,
    handleCardSizeChange,
  };
}
