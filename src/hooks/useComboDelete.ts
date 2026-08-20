import { useState } from 'react';
import { toast } from 'sonner';
import { deleteCombo, deleteCombos } from '@/lib/application/comboCommands';
import { reportError } from '@/lib/errors';

interface ComboDeleteOptions {
  confirmBeforeDelete: boolean;
}

/**
 * Manages delete confirmation state and delete operations
 */
export function useComboDelete({ confirmBeforeDelete }: ComboDeleteOptions) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const executeDelete = async (comboId: string) => {
    try {
      await deleteCombo(comboId);
      toast.success('Combo deleted');
      return true;
    } catch (err) {
      reportError('useComboDelete.executeDelete', err);
      toast.error('Failed to delete combo');
      return false;
    }
  };

  const handleDelete = async (comboId: string) => {
    if (confirmBeforeDelete) {
      setDeleteTarget(comboId);
      return false;
    }
    await executeDelete(comboId);
  };

  const executeBulkDelete = async (selectedIds: Set<string>) => {
    try {
      await deleteCombos([...selectedIds]);
      toast.success(
        `${selectedIds.size} combo${selectedIds.size > 1 ? 's' : ''} deleted`,
      );
      return true;
    } catch (err) {
      reportError('useComboDelete.executeBulkDelete', err);
      toast.error('Failed to delete combos');
      return false;
    }
  };

  const handleBulkDelete = (selectedIds: Set<string>) => {
    if (selectedIds.size === 0) return false;
    if (confirmBeforeDelete) {
      setBulkDeleteConfirm(true);
      return false;
    }
    return executeBulkDelete(selectedIds);
  };

  return {
    deleteTarget,
    setDeleteTarget,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    executeDelete,
    handleDelete,
    executeBulkDelete,
    handleBulkDelete,
  };
}
