import { useState } from 'react';
import { toast } from 'sonner';
import { reportError } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

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
      await indexedDbStorage.combos.delete(comboId);
      toast.success('Combo deleted');
    } catch (err) {
      reportError('useComboDelete.executeDelete', err);
      toast.error('Failed to delete combo');
    }
  };

  const handleDelete = async (comboId: string) => {
    if (confirmBeforeDelete) {
      setDeleteTarget(comboId);
      return;
    }
    await executeDelete(comboId);
  };

  const executeBulkDelete = async (selectedIds: Set<string>) => {
    try {
      await indexedDbStorage.combos.bulkDelete([...selectedIds]);
      toast.success(
        `${selectedIds.size} combo${selectedIds.size > 1 ? 's' : ''} deleted`,
      );
    } catch (err) {
      reportError('useComboDelete.executeBulkDelete', err);
      toast.error('Failed to delete combos');
    }
  };

  const handleBulkDelete = (selectedIds: Set<string>) => {
    if (selectedIds.size === 0) return;
    if (confirmBeforeDelete) {
      setBulkDeleteConfirm(true);
      return;
    }
    void executeBulkDelete(selectedIds);
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
