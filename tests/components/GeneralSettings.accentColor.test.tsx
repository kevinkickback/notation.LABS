import { render, screen, fireEvent } from '@testing-library/react';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { describe, expect, it, vi } from 'vitest';

// Mock indexedDbStorage
vi.mock('@/lib/storage/indexedDbStorage', () => ({
	indexedDbStorage: {
		settings: {
			get: vi.fn(async () => ({ ...DEFAULT_SETTINGS })),
			update: vi.fn(async () => {}),
		},
	},
}));

describe('GeneralSettings accent color', () => {
	it('renders accent color picker and updates CSS variable', async () => {
		render(<GeneralSettings />);
		// Wait for settings to load
		expect(await screen.findByLabelText(/accent color picker/i)).not.toBeNull();
		const colorInput = screen.getByLabelText(
			/accent color picker/i,
		) as HTMLInputElement;
		// Simulate color change
		fireEvent.change(colorInput, { target: { value: '#ff0000' } });
		// CSS variable should be set
		expect(
			document.documentElement.style.getPropertyValue('--accent-color'),
		).toBe('#ff0000');
	});
});
