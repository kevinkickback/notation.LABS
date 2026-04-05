import { useCallback, useEffect, useState } from 'react';
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
          const overrides = await indexedDbStorage.settings.getNotesOverrides();
          const updated =
            next !== defaultOpen
              ? [...new Set([...overrides, entityId])]
              : overrides.filter((id) => id !== entityId);
          await indexedDbStorage.settings.setNotesOverrides(updated);
        } catch (error) {
          reportError('useNotesOverride.handleToggle', error);
        }
      })();

      return next;
    });
  }, [defaultOpen, entityId]);

  return [showNotes, handleToggle];
}

/** Removes the notes override entry for a deleted entity. */
export async function removeNotesOverride(entityId: string): Promise<void> {
  await indexedDbStorage.settings.removeNotesOverride(entityId);
}
