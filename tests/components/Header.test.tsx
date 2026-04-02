import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '@/components/header/Header';

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
});