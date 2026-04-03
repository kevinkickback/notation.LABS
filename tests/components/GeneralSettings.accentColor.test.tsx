import { render, screen, fireEvent } from '@testing-library/react';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkForUpdateMock = vi.fn();

vi.mock('sonner', () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

// Mock indexedDbStorage
vi.mock('@/lib/storage/indexedDbStorage', () => ({
	indexedDbStorage: {
		settings: {
			get: vi.fn(async () => ({ ...DEFAULT_SETTINGS })),
			update: vi.fn(async () => { }),
		},
	},
}));

describe('GeneralSettings accent color', () => {
	beforeEach(() => {
		checkForUpdateMock.mockReset();
		window.electronAPI = {
			platform: 'win32',
			versions: {
				electron: '40.0.0',
				chrome: '140.0.0',
				node: '22.0.0',
			},
			checkForUpdate: checkForUpdateMock,
			downloadUpdate: vi.fn(),
			cancelUpdate: vi.fn(),
			installUpdate: vi.fn(),
			getUpdateStatus: vi.fn(),
			setAutoCheck: vi.fn(),
			getAppVersion: vi.fn().mockResolvedValue('1.3.0'),
			getCurrentChangelog: vi.fn().mockResolvedValue({
				version: '1.3.0',
				changelog: 'Notes',
			}),
			onUpdateChecking: vi.fn(() => () => { }),
			onUpdateAvailable: vi.fn(() => () => { }),
			onUpdateNotAvailable: vi.fn(() => () => { }),
			onUpdateError: vi.fn(() => () => { }),
			onDownloadProgress: vi.fn(() => () => { }),
			onUpdateDownloaded: vi.fn(() => () => { }),
			onUpdateCancelled: vi.fn(() => () => { }),
		};
	});

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

	it('shows update check failure instead of up-to-date on failed responses', async () => {
		checkForUpdateMock.mockResolvedValue({
			success: false,
			data: null,
			error: 'network down',
		});

		render(<GeneralSettings />);

		fireEvent.click(await screen.findByRole('button', { name: /check now/i }));

		expect(await screen.findByText(/check failed/i)).not.toBeNull();
		expect(screen.queryByText(/up to date/i)).toBeNull();
	});
});
