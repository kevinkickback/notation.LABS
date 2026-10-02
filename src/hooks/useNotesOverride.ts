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
    overrides: string[];
    isOpen: boolean;
  } | null>(null);
  const showNotes =
    optimistic?.entityId === entityId &&
    optimistic.defaultOpen === defaultOpen &&
    optimistic.overrides === notesOverrides
      ? optimistic.isOpen
      : resolveShowNotes(entityId, defaultOpen, notesOverrides);

  useEffect(() => {
    setOptimistic((current) =>
      current &&
      (current.entityId !== entityId ||
        current.defaultOpen !== defaultOpen ||
        current.overrides !== notesOverrides)
        ? null
        : current,
    );
  }, [entityId, defaultOpen, notesOverrides]);

  const handleToggle = useCallback(() => {
    const next = {
      entityId,
      defaultOpen,
      overrides: notesOverrides,
      isOpen: !showNotes,
    };
    setOptimistic(next);
    void (async () => {
      try {
        await setNotesPanelOpen(entityId, next.isOpen);
      } catch (error) {
        setOptimistic((current) => (current === next ? null : current));
        reportError('useNotesOverride.handleToggle', error);
      }
    })();
  }, [defaultOpen, entityId, notesOverrides, setNotesPanelOpen, showNotes]);

  return [showNotes, handleToggle];
}
