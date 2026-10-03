import { act, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const settings = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/context/SettingsContext', () => ({ useSettings: settings.read }));

afterEach(() => { act(() => { toast.dismiss(); }); });

describe('Toaster appearance', () => {
  it.each(['light', 'dark'] as const)('keeps an existing notification when switching from %s mode', async initial => {
    settings.read.mockReturnValue({ ...DEFAULT_SETTINGS, colorTheme: initial });
    const { container, rerender } = render(<Toaster />);
    act(() => { toast.info('Saved preference', { description: 'Your choice is saved', duration: Number.POSITIVE_INFINITY }); });
    expect(await screen.findByText('Your choice is saved')).toBeTruthy();
    const notifications = container.querySelector('[data-sonner-toaster]');
    expect(notifications?.getAttribute('data-sonner-theme')).toBe(initial);

    const next = initial === 'light' ? 'dark' : 'light';
    settings.read.mockReturnValue({ ...DEFAULT_SETTINGS, colorTheme: next });
    rerender(<Toaster />);
    await waitFor(() => expect(notifications?.getAttribute('data-sonner-theme')).toBe(next));
    expect(screen.getByText('Saved preference')).toBeTruthy();
    expect(screen.getByText('Your choice is saved')).toBeTruthy();
  });
});
