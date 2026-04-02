import { useState, useEffect } from 'react';

const NOTES_OVERRIDES_KEY = 'notes_overrides';

function readOverrides(): string[] {
	try {
		return JSON.parse(
			localStorage.getItem(NOTES_OVERRIDES_KEY) ?? '[]',
		) as string[];
	} catch {
		return [];
	}
}

/**
 * Manages per-entity notes panel open/close state, persisted in localStorage
 * as an override list relative to the global `notesDefaultOpen` setting.
 */
export function useNotesOverride(
	entityId: string,
	defaultOpen: boolean,
): [boolean, () => void] {
	const [showNotes, setShowNotes] = useState(false);

	useEffect(() => {
		const overrides = readOverrides();
		setShowNotes(overrides.includes(entityId) ? !defaultOpen : defaultOpen);
	}, [entityId, defaultOpen]);

	const handleToggle = () => {
		const next = !showNotes;
		setShowNotes(next);
		const overrides = readOverrides();
		const updated =
			next !== defaultOpen
				? [...new Set([...overrides, entityId])]
				: overrides.filter((id) => id !== entityId);
		localStorage.setItem(NOTES_OVERRIDES_KEY, JSON.stringify(updated));
	};

	return [showNotes, handleToggle];
}

/** Removes the notes override entry for a deleted entity. */
export function removeNotesOverride(entityId: string): void {
	const overrides = readOverrides();
	const cleaned = overrides.filter((id) => id !== entityId);
	if (cleaned.length !== overrides.length) {
		localStorage.setItem(NOTES_OVERRIDES_KEY, JSON.stringify(cleaned));
	}
}
