import { useEffect, useState } from 'react';
import { useSettingsActions } from '@/context/SettingsContext';

type CardSizeSetting = 'gameCardSize' | 'characterCardSize';

const preserveSize = (size: number) => size;

export function usePersistedCardSize(
  setting: CardSizeSetting,
  initialSize: number,
  normalizeSize: (size: number) => number = preserveSize,
) {
  const { setSetting } = useSettingsActions();
  const [cardSize, setCardSize] = useState(() => normalizeSize(initialSize));

  useEffect(() => {
    setCardSize(normalizeSize(initialSize));
  }, [initialSize, normalizeSize]);

  const handleCardSizeChange = (size: number) => {
    const normalizedSize = normalizeSize(size);
    setCardSize(normalizedSize);
    void setSetting(setting, normalizedSize);
  };

  return { cardSize, handleCardSizeChange };
}
