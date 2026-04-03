import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsProvider } from '@/context/SettingsContext';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const initMock = vi.fn();
const getMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('dexie-react-hooks', () => ({
    useLiveQuery: () => DEFAULT_SETTINGS,
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
    indexedDbStorage: {
        settings: {
            init: (...args: unknown[]) => initMock(...args),
            get: (...args: unknown[]) => getMock(...args),
        },
    },
}));

vi.mock('sonner', () => ({
    toast: {
        error: (...args: unknown[]) => toastErrorMock(...args),
    },
}));

describe('SettingsContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getMock.mockResolvedValue(DEFAULT_SETTINGS);
    });

    it('shows a toast when settings initialization fails', async () => {
        initMock.mockRejectedValueOnce(new Error('db unavailable'));

        render(
            <SettingsProvider>
                <div>child</div>
            </SettingsProvider>,
        );

        await waitFor(() => {
            expect(toastErrorMock).toHaveBeenCalledWith(
                'Failed to load saved settings: db unavailable',
            );
        });
    });
});
