import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistedCardSize } from '@/hooks/usePersistedCardSize';

const { setSettingMock } = vi.hoisted(() => ({
  setSettingMock: vi.fn(),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettingsActions: () => ({ setSetting: setSettingMock }),
}));

describe('usePersistedCardSize', () => {
  beforeEach(() => {
    setSettingMock.mockReset();
    setSettingMock.mockResolvedValue(undefined);
  });

  it('updates local state and persists the normalized size', () => {
    const clampSize = (size: number) => Math.min(300, Math.max(120, size));
    const { result } = renderHook(() =>
      usePersistedCardSize('characterCardSize', 180, clampSize),
    );

    act(() => result.current.handleCardSizeChange(500));

    expect(result.current.cardSize).toBe(300);
    expect(setSettingMock).toHaveBeenCalledWith('characterCardSize', 300);
  });

  it('synchronizes when the persisted size changes', () => {
    const { result, rerender } = renderHook(
      ({ initialSize }) =>
        usePersistedCardSize('gameCardSize', initialSize),
      { initialProps: { initialSize: 180 } },
    );

    rerender({ initialSize: 240 });

    expect(result.current.cardSize).toBe(240);
  });
});