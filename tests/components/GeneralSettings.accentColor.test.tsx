import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { DEFAULT_SETTINGS, getFontFamilyCSS } from '@/lib/defaults';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkForUpdateMock = vi.fn();
const getCurrentChangelogMock = vi.fn();

vi.mock('@/components/ui/select', async () => {
	const React = await import('react');
	const SelectContext = React.createContext<{
		value: string;
		onValueChange: (value: string) => void;
	}>({
		value: '',
		onValueChange: () => { },
	});

	return {
		Select: ({
			value,
			onValueChange,
			children,
		}: {
			value: string;
			onValueChange: (value: string) => void;
			children: ReactNode;
		}) => (
			<SelectContext.Provider value={{ value, onValueChange }}>
				{children}
			</SelectContext.Provider>
		),
		SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
		SelectValue: () => {
			const { value } = React.useContext(SelectContext);
			return <span>{value}</span>;
		},
		SelectContent: ({ children }: { children: ReactNode }) => {
			const { value, onValueChange } = React.useContext(SelectContext);
			return (
				<select
					aria-label="mock-select"
					value={value}
					onChange={(e) => onValueChange(e.target.value)}
				>
					{children}
				</select>
			);
		},
		SelectItem: ({
			value,
			children,
		}: {
			value: string;
			children: ReactNode;
		}) => (
			<option value={value}>{children}</option>
		),
	};
});

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
		getCurrentChangelogMock.mockReset();
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
			getCurrentChangelog: getCurrentChangelogMock.mockResolvedValue({
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

	it('updates the document theme class when the theme changes', async () => {
		render(<GeneralSettings />);

		const selects = await screen.findAllByLabelText('mock-select');
		fireEvent.change(selects[0], { target: { value: 'light' } });

		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('updates the app font CSS variable when the font changes', async () => {
		render(<GeneralSettings />);

		const selects = await screen.findAllByLabelText('mock-select');
		fireEvent.change(selects[1], { target: { value: 'jetbrains-mono' } });

		expect(
			document.documentElement.style.getPropertyValue('--app-font-family'),
		).toBe(getFontFamilyCSS('jetbrains-mono'));
	});

	it('loads the current changelog in electron mode', async () => {
		render(<GeneralSettings />);

		fireEvent.click(await screen.findByRole('button', { name: /^view$/i }));

		expect(getCurrentChangelogMock).toHaveBeenCalled();
		expect(await screen.findByText(/^Notes$/)).not.toBeNull();
	});
});
