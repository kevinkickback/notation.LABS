import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  duplicateCombo,
  markCombosOutdated,
} from '@/lib/application/comboCommands';
import { reportError } from '@/lib/errors';
import type { Combo } from '@/lib/types';

/**
 * Manages common combo operations: create, edit, duplicate, mark outdated
 */
export function useComboOperations() {
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEdit = useCallback((combo: Combo) => {
    setEditingCombo(combo);
    setDialogOpen(true);
  }, []);

  const handleDuplicate = useCallback(async (combo: Combo) => {
    try {
      await duplicateCombo(combo);
      toast.success('Combo duplicated');
    } catch (err) {
      reportError('useComboOperations.handleDuplicate', err);
      toast.error('Failed to duplicate combo');
    }
  }, []);

  const handleBulkMarkOutdated = useCallback(
    async (selectedIds: Set<string>, outdated: boolean) => {
      if (selectedIds.size === 0) return;
      try {
        await markCombosOutdated([...selectedIds], outdated);
        toast.success(
          `${selectedIds.size} combo${selectedIds.size > 1 ? 's' : ''} marked as ${outdated ? 'outdated' : 'current'}`,
        );
      } catch (err) {
        reportError('useComboOperations.handleBulkMarkOutdated', err);
        toast.error('Failed to update combos');
      }
    },
    [],
  );

  return {
    editingCombo,
    setEditingCombo,
    dialogOpen,
    setDialogOpen,
    handleEdit,
    handleDuplicate,
    handleBulkMarkOutdated,
  };
}
