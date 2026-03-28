import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { describe, it, expect, vi } from 'vitest';

// Mock all settings subcomponents to simple stubs
vi.mock('@/components/settings/GeneralSettings', () => ({
	GeneralSettings: () => <div>General Settings Content</div>,
}));
vi.mock('@/components/settings/ColorCustomization', () => ({
	ColorCustomization: () => <div>Color Customization Content</div>,
}));
vi.mock('@/components/settings/NotationSettings', () => ({
	NotationSettings: () => <div>Notation Settings Content</div>,
}));
vi.mock('@/components/settings/AboutTab', () => ({
	AboutTab: () => <div>About Tab Content</div>,
}));

describe('SettingsPanel', () => {
	it('renders and switches tabs', async () => {
		const onOpenChange = vi.fn();
		render(<SettingsPanel open={true} onOpenChange={onOpenChange} />);
		// General tab is default
		expect(screen.getByText(/general settings content/i)).not.toBeNull();
		// Switch to Colors
		await userEvent.click(screen.getByText(/colors/i));
		expect(screen.getByText(/color customization content/i)).not.toBeNull();
		// Switch to Notation
		await userEvent.click(screen.getByText(/notation/i));
		expect(screen.getByText(/notation settings content/i)).not.toBeNull();
		// Switch to About
		await userEvent.click(screen.getByText(/about/i));
		expect(screen.getByText(/about tab content/i)).not.toBeNull();
	});
});
