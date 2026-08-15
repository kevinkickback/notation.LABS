import { useEffect, useState } from 'react';
import { setSetting } from '@/lib/application/settingsCommands';

const clampCharSize = (v: number) => Math.min(300, Math.max(120, v));

/**
 * Manages character view mode and card size.
 */
export function useCharacterViewMode(initialCardSize: number) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cardSize, setCardSize] = useState(() =>
    clampCharSize(initialCardSize),
  );

  useEffect(() => {
    setCardSize(clampCharSize(initialCardSize));
  }, [initialCardSize]);

  const handleCardSizeChange = async (size: number) => {
    setCardSize(size);
    await setSetting('characterCardSize', size);
  };

  return {
    viewMode,
    setViewMode,
    cardSize,
    handleCardSizeChange,
  };
}
