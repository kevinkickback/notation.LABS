import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '@/components/header/Header';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { toast } from 'sonner';

vi.mock('@/lib/storage/indexedDbStorage', () => ({
    indexedDbStorage: {
        export: vi.fn(),
        import: vi.fn(),
    },
}));

vi.mock('@/components/settings/SettingsPanel', () => ({
    SettingsPanel: () => null,
}));

vi.mock('@/components/header/ExportDialog', () => ({
    ExportDialog: () => null,
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Header', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens the notation guide from the mobile menu without DOM querying', async () => {
        const user = userEvent.setup();

        render(<Header />);

        await user.click(screen.getByRole('button', { name: /open menu/i }));
        await user.click(screen.getByRole('menuitem', { name: /notation guide/i }));

        expect(await screen.findByText('Combo Notation Guide')).toBeTruthy();
    });

    it('rejects oversized import files before calling storage import', async () => {
        const user = userEvent.setup();
        const { container } = render(<Header />);

        const input = container.querySelector('input[type="file"]');
        expect(input).toBeTruthy();

        const file = new File(['{}'], 'backup.json', {
            type: 'application/json',
        });
        Object.defineProperty(file, 'size', {
            value: 50 * 1024 * 1024 + 1,
        });

        await user.upload(input as HTMLInputElement, file);

        expect(toast.error).toHaveBeenCalledWith('Import file exceeds 50 MB limit');
        expect(indexedDbStorage.import).not.toHaveBeenCalled();
    });

    it('passes selected import options to storage import', async () => {
        const user = userEvent.setup();
        const { container } = render(<Header />);

        await user.click(screen.getAllByRole('button', { name: /import data/i })[0]);
        await user.click(screen.getByRole('switch', { name: /include demo videos/i }));
        await user.click(screen.getByRole('switch', { name: /replace settings/i }));
        await user.click(screen.getByRole('button', { name: /choose backup file/i }));

        const input = container.querySelector('input[type="file"]');
        expect(input).toBeTruthy();

        const file = new File(['{"version":1,"exported":"now"}'], 'backup.json', {
            type: 'application/json',
        });

        await user.upload(input as HTMLInputElement, file);

        expect(indexedDbStorage.import).toHaveBeenCalledWith(
            '{"version":1,"exported":"now"}',
            false,
            true,
        );
        expect(toast.success).toHaveBeenCalledWith(
            'Data imported. Settings were replaced from backup.',
        );
    });
});