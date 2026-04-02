import { useState } from 'react';
import type { Combo } from '@/lib/types';
import { indexedDbStorage, db } from '@/lib/storage/indexedDbStorage';
import { toast } from 'sonner';

interface ComboDeleteOptions {
	confirmBeforeDelete: boolean;
	combos: Combo[];
}

/**
 * Manages delete confirmation state and delete operations
 */
export function useComboDelete({
	confirmBeforeDelete,
	combos,
}: ComboDeleteOptions) {
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
	const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

	const executeDelete = async (comboId: string) => {
		try {
			const combo = combos.find((c) => c.id === comboId);
			if (combo?.demoUrl?.startsWith('local:')) {
				await indexedDbStorage.demoVideos.delete(
					combo.demoUrl.replace('local:', ''),
				);
			}
			await indexedDbStorage.combos.delete(comboId);
			toast.success('Combo deleted');
		} catch {
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
			await db.transaction('rw', [db.combos, db.demoVideos], async () => {
				for (const id of selectedIds) {
					const combo = combos.find((c) => c.id === id);
					if (combo?.demoUrl?.startsWith('local:')) {
						await indexedDbStorage.demoVideos.delete(
							combo.demoUrl.replace('local:', ''),
						);
					}
					await indexedDbStorage.combos.delete(id);
				}
			});
			toast.success(
				`${selectedIds.size} combo${selectedIds.size > 1 ? 's' : ''} deleted`,
			);
		} catch {
			toast.error('Failed to delete combos');
		}
	};

	const handleBulkDelete = (selectedIds: Set<string>) => {
		if (selectedIds.size === 0) return;
		if (confirmBeforeDelete) {
			setBulkDeleteConfirm(true);
			return;
		}
		executeBulkDelete(selectedIds);
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
