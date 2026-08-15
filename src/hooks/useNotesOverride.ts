import { useCallback, useEffect, useState } from 'react';
import { useSettingsActions } from '@/context/SettingsContext';
import { reportError } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

function resolveShowNotes(
  entityId: string,
  defaultOpen: boolean,
  overrides: string[],
): boolean {
  return overrides.includes(entityId) ? !defaultOpen : defaultOpen;
}

/**
 * Manages per-entity notes panel open/close state, persisted in IndexedDB
 * as an override list relative to the global `notesDefaultOpen` setting.
 */
export function useNotesOverride(
  entityId: string,
  defaultOpen: boolean,
): [boolean, () => void] {
  const { setNotesOverride } = useSettingsActions();
  const [showNotes, setShowNotes] = useState(defaultOpen);

  useEffect(() => {
    let isActive = true;

    const loadOverrides = async () => {
      try {
        const overrides = await indexedDbStorage.settings.getNotesOverrides();
        if (!isActive) {
          return;
        }
        setShowNotes(resolveShowNotes(entityId, defaultOpen, overrides));
      } catch (error) {
        reportError('useNotesOverride.loadOverrides', error);
        if (isActive) {
          setShowNotes(defaultOpen);
        }
      }
    };

    void loadOverrides();

    return () => {
      isActive = false;
    };
  }, [entityId, defaultOpen]);

  const handleToggle = useCallback(() => {
    setShowNotes((current) => {
      const next = !current;

      void (async () => {
        try {
          await setNotesOverride(entityId, next !== defaultOpen);
        } catch (error) {
          setShowNotes((latest) => (latest === next ? !next : latest));
          reportError('useNotesOverride.handleToggle', error);
        }
      })();

      return next;
    });
  }, [defaultOpen, entityId, setNotesOverride]);

  return [showNotes, handleToggle];
}
