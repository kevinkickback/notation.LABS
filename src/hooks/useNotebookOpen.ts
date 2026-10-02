import { useCallback, useEffect, useState } from 'react';
import { useSettings, useSettingsActions } from '@/context/SettingsContext';
import { reportError } from '@/lib/errors';

const EMPTY_PAGES: string[] = [];

/**
 * Remembers each game or character's open/closed notebook state.
 */
export function useNotebookOpen(entityId: string): [boolean, () => void] {
  const { setNotesPanelOpen } = useSettingsActions();
  const { notebookOpenPages = EMPTY_PAGES } = useSettings();
  const [optimistic, setOptimistic] = useState<{
    entityId: string;
    isOpen: boolean;
    pending: boolean;
  } | null>(null);
  const persistedOpen = notebookOpenPages.includes(entityId);
  const showNotes =
    optimistic?.entityId === entityId ? optimistic.isOpen : persistedOpen;

  useEffect(() => {
    if (
      optimistic &&
      (optimistic.entityId !== entityId ||
        (!optimistic.pending && persistedOpen === optimistic.isOpen))
    ) {
      setOptimistic(null);
    }
  }, [entityId, persistedOpen, optimistic]);

  const handleToggle = useCallback(() => {
    const next = {
      entityId,
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
        reportError('useNotebookOpen.handleToggle', error);
      }
    })();
  }, [entityId, setNotesPanelOpen, showNotes]);

  return [showNotes, handleToggle];
}
