/**
 * Deletes the IndexedDB database to simulate a fresh install.
 * Import at the top of main.tsx before any other app code runs.
 * Activated by setting VITE_RESET_DB=true (e.g. npm run dev:fresh).
 */

const DB_NAME = 'FightingGameComboTracker';

export async function resetDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(DB_NAME);

		request.onsuccess = () => {
			console.log(`[reset-db] Deleted "${DB_NAME}" — app will start fresh.`);
			resolve();
		};

		request.onerror = () => {
			console.error(`[reset-db] Failed to delete "${DB_NAME}".`);
			reject(new Error(`Failed to delete database "${DB_NAME}"`));
		};

		request.onblocked = () => {
			console.warn(
				`[reset-db] Delete blocked — close all other tabs using the app and retry.`,
			);
			resolve();
		};
	});
}
