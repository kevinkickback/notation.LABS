import { useCallback, useEffect, useState } from 'react';
import { useSettings, useSettingsActions } from '@/context/SettingsContext';
import { reportError } from '@/lib/errors';

const EMPTY_OVERRIDES: string[] = [];

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
  const { setNotesPanelOpen } = useSettingsActions();
  const { notesOverrides = EMPTY_OVERRIDES } = useSettings();
  const [optimistic, setOptimistic] = useState<{
    entityId: string;
    defaultOpen: boolean;
    isOpen: boolean;
    pending: boolean;
  } | null>(null);
  const persistedOpen = resolveShowNotes(entityId, defaultOpen, notesOverrides);
  const showNotes =
    optimistic?.entityId === entityId && optimistic.defaultOpen === defaultOpen
      ? optimistic.isOpen
      : persistedOpen;

  useEffect(() => {
    if (
      optimistic &&
      (optimistic.entityId !== entityId ||
        optimistic.defaultOpen !== defaultOpen ||
        (!optimistic.pending && persistedOpen === optimistic.isOpen))
    ) {
      setOptimistic(null);
    }
  }, [entityId, defaultOpen, persistedOpen, optimistic]);

  const handleToggle = useCallback(() => {
    const next = {
      entityId,
      defaultOpen,
      isOpen: !showNotes,
      pending: true,
    };
    setOptimistic(next);
    void (async () => {
      try {
        await setNotesPanelOpen(entityId, next.isOpen);
        // Keep the latest choice until the live snapshot acknowledges its save.
        setOptimistic((current) =>
          current === next ? { ...current, pending: false } : current,
        );
      } catch (error) {
        setOptimistic((current) => (current === next ? null : current));
        reportError('useNotesOverride.handleToggle', error);
      }
    })();
  }, [defaultOpen, entityId, setNotesPanelOpen, showNotes]);

  return [showNotes, handleToggle];
}
