import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { useAppStore } from '@/lib/store';
import { INITIAL_UPDATE_STATUS } from '@/lib/updater/ipcContract';
import { updateDetails, updateSnapshot } from './helpers/updater';

const mocks = vi.hoisted(() => ({
  useLiveQuery: vi.fn(),
  useSettings: vi.fn(),
  useSettingsInitialization: vi.fn(),
  useUpdater: vi.fn(),
  toastInfo: vi.fn(),
  reportError: vi.fn(),
  gamesGetAll: vi.fn(),
  charactersGetByGame: vi.fn(),
  combosGetByCharacter: vi.fn(),
}));

vi.mock('@/hooks/useRecoverableLiveQuery', () => ({
  useRecoverableLiveQuery: (...args: unknown[]) => mocks.useLiveQuery(...args),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => mocks.useSettings(),
  useSettingsInitialization: () => mocks.useSettingsInitialization(),
}));

vi.mock('@/context/UpdaterContext', () => ({
  useUpdater: () => mocks.useUpdater(),
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    games: { getAll: mocks.gamesGetAll },
    characters: { getByGame: mocks.charactersGetByGame },
    combos: { getByCharacter: mocks.combosGetByCharacter },
  },
}));

vi.mock('sonner', () => ({
  toast: { info: (...args: unknown[]) => mocks.toastInfo(...args) },
}));

vi.mock('@/lib/errors', () => ({
  reportError: (...args: unknown[]) => mocks.reportError(...args),
}));

vi.mock('@/components/game/GameLibrary', () => ({
  GameLibrary: ({ games }: { games: Array<{ name: string }> }) => (
    <div>Games: {games.map((game) => game.name).join(', ')}</div>
  ),
}));

vi.mock('@/components/character/CharacterView', () => ({
  CharacterView: ({
    game,
    characters,
  }: {
    game: { name: string };
    characters: Array<{ name: string }>;
  }) => (
    <div>
      Characters for {game.name}: {characters.map((item) => item.name).join(', ')}
    </div>
  ),
}));

vi.mock('@/components/combo/ComboView', () => ({
  ComboView: ({
    game,
    character,
    combos,
  }: {
    game: { name: string };
    character: { name: string };
    combos: Array<{ name: string }>;
  }) => (
    <div>
      Combos for {game.name}/{character.name}:{' '}
      {combos.map((combo) => combo.name).join(', ')}
    </div>
  ),
}));

vi.mock('@/components/header/Header', () => ({ Header: () => <header>Header</header> }));
vi.mock('@/components/header/BreadcrumbBar', () => ({
  BreadcrumbBar: () => <nav>Breadcrumbs</nav>,
}));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));

vi.mock('@/components/updates/ChangelogModal', () => ({
  ChangelogModal: ({
    open,
    version,
    changelog,
    onInstall,
    installLabel,
  }: {
    open: boolean;
    version: string;
    changelog: string | null;
    onInstall: () => void;
    installLabel?: string;
  }) =>
    open ? (
      <div>
        Changelog {version}: {changelog}
        <button type="button" onClick={onInstall}>
          {installLabel ?? 'Install update'}
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/updates/UpdateProgressModal', () => ({
  UpdateProgressModal: ({ open, version }: { open: boolean; version: string }) =>
    open ? <div>Downloading update {version}</div> : null,
}));

const queryData = {
  games: [{ id: 'game-1', name: 'Fighter One', updatedAt: 1 }],
  characters: [
    {
      id: 'character-1',
      gameId: 'game-1',
      name: 'Hero',
      updatedAt: 1,
    },
  ],
  combos: [
    {
      id: 'combo-1',
      gameId: 'game-1',
      characterId: 'character-1',
      name: 'Starter',
      updatedAt: 1,
    },
  ],
};

function pageSnapshot(gameId: string | null = null, characterId: string | null = null) {
  return { gameId, characterId, parsedNotationVersion: DEFAULT_SETTINGS.parsedNotationVersion, ...queryData };
}

function installElectronApi(overrides: Partial<Window['electronAPI']> = {}) {
  window.electronAPI = {
    platform: 'win32',
    versions: { electron: '40', chrome: '140', node: '22' },
    checkForUpdate: vi.fn(),
    downloadUpdate: vi.fn(),
    cancelUpdate: vi.fn(),
    installUpdate: vi.fn(),
    onUpdateStatus: vi.fn(() => () => {}),
    getUpdateStatus: vi.fn(),
    setAutoCheck: vi.fn().mockResolvedValue(undefined),
    getAppVersion: vi.fn().mockResolvedValue('1.8.0'),
    getCurrentChangelog: vi.fn(),

    beginBackup: vi.fn(), writeBackupChunk: vi.fn(), finishBackup: vi.fn(), abortBackup: vi.fn(), getBackupCapacity: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      selectedGameId: null,
      selectedCharacterId: null,
    });
    mocks.useSettings.mockReturnValue(DEFAULT_SETTINGS);
    mocks.useSettingsInitialization.mockReturnValue({ initialized: true, isReparsing: false, error: null, retry: vi.fn() });
    mocks.useUpdater.mockReturnValue({
      status: INITIAL_UPDATE_STATUS,
      availabilityEventId: 0,
      downloadUpdate: vi.fn(),
      showAvailableUpdate: vi.fn(),
    });
    const pages = new Map<string, ReturnType<typeof pageSnapshot>>();
    mocks.useLiveQuery.mockImplementation(
      (_query: unknown, dependencies: unknown[]) => {
        const key = JSON.stringify(dependencies);
        if (!pages.has(key)) pages.set(key, pageSnapshot(dependencies[0] as string | null, dependencies[1] as string | null));
        const data = pages.get(key);
        return { data, error: null };
      },
    );
    installElectronApi();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--app-font-family');
    document.documentElement.style.removeProperty('--accent-color');
  });

  it('routes from games to characters to combos using the selected entities', () => {
    vi.useFakeTimers();
    render(<App />);
    act(() => vi.advanceTimersByTime(650));

    expect(screen.getByText('Games: Fighter One')).toBeTruthy();

    act(() => useAppStore.getState().setSelectedGame('game-1'));
    expect(screen.getByText('Characters for Fighter One: Hero')).toBeTruthy();

    act(() => useAppStore.getState().setSelectedCharacter('character-1'));
    expect(
      screen.getByText('Combos for Fighter One/Hero: Starter'),
    ).toBeTruthy();
    expect(mocks.useLiveQuery).toHaveBeenCalledWith(
      expect.any(Function),
      ['game-1', 'character-1', DEFAULT_SETTINGS.parsedNotationVersion],
      0,
    );
  });

  it.each([
    ['settings', false, false, false, 'Restoring your preferences', '20'],
    ['parsing', false, true, false, 'Updating stored combo notation', '50'],
    ['library', true, false, true, 'Opening your game library', '75'],
  ])('keeps the workspace inert during the %s stage', (_stage, initialized, isReparsing, pendingLibrary, description, progress) => {
    vi.useFakeTimers();
    mocks.useSettingsInitialization.mockReturnValue({ initialized, isReparsing, error: null, retry: vi.fn() });
    if (pendingLibrary) mocks.useLiveQuery.mockReturnValue({ data: undefined, error: null });
    const { container } = render(<App />);
    expect(screen.getByRole('status').textContent).toContain(description);
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe(progress);
    const workspace = container.querySelector('.app-workspace');
    expect(workspace?.hasAttribute('inert')).toBe(true);
    expect(workspace?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByText('Header')).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('app-loading-overlay')).toBeTruthy();
  });

  it('retries initialization and library queries after a startup failure', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    mocks.useSettingsInitialization.mockReturnValue({ initialized: false, isReparsing: false, error: 'Settings database unavailable', retry });
    const { container, rerender } = render(<App />);
    expect(screen.getByRole('alert').textContent).toBe('Settings database unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(mocks.useLiveQuery).toHaveBeenCalledWith(expect.any(Function), [null, null, DEFAULT_SETTINGS.parsedNotationVersion], 1);
    mocks.useSettingsInitialization.mockReturnValue({ initialized: true, isReparsing: false, error: null, retry });
    rerender(<App />);
    act(() => vi.advanceTimersByTime(650));
    expect(screen.queryByTestId('app-loading-overlay')).toBeNull();
    expect(container.querySelector('.app-workspace')?.hasAttribute('inert')).toBe(false);
    expect(screen.getByText('Games: Fighter One')).toBeTruthy();
  });

  it('keeps a failed library read in the overlay until retry succeeds', () => {
    vi.useFakeTimers();
    mocks.useLiveQuery.mockReturnValue({ data: undefined, error: 'Library is locked' });
    const { rerender } = render(<App />);
    expect(screen.getByRole('alert').textContent).toBe('Library is locked');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Header')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    mocks.useLiveQuery.mockReturnValue({ data: pageSnapshot(), error: null });
    rerender(<App />);
    act(() => vi.advanceTimersByTime(650));
    expect(screen.queryByTestId('app-loading-overlay')).toBeNull();
    expect(screen.getByText('Games: Fighter One')).toBeTruthy();
  });

  it('keeps the previous screen inert for pending reads and retained results', () => {
    vi.useFakeTimers();
    const home = pageSnapshot();
    mocks.useLiveQuery.mockReturnValue({ data: home, error: null });
    const { container, rerender } = render(<App />);
    act(() => vi.advanceTimersByTime(650));
    mocks.useLiveQuery.mockReturnValue({ data: undefined, error: null });
    act(() => useAppStore.getState().setSelectedGame('game-1'));
    expect(screen.getByText('Games: Fighter One')).toBeTruthy();
    expect(container.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('main')?.hasAttribute('inert')).toBe(true);
    mocks.useLiveQuery.mockReturnValue({ data: home, error: null });
    rerender(<App />);
    expect(screen.queryByText('Characters for Fighter One: Hero')).toBeNull();
    const characterPage = pageSnapshot('game-1');
    mocks.useLiveQuery.mockReturnValue({ data: characterPage, error: null });
    rerender(<App />);
    expect(screen.getByText('Characters for Fighter One: Hero')).toBeTruthy();
    expect(container.querySelector('main')?.hasAttribute('inert')).toBe(false);
    act(() => useAppStore.getState().setSelectedCharacter('character-1'));
    expect(screen.getByText('Characters for Fighter One: Hero')).toBeTruthy();
    mocks.useLiveQuery.mockReturnValue({ data: { ...pageSnapshot('game-1', 'character-1'), combos: [] }, error: null });
    rerender(<App />);
    expect(screen.getByText('Combos for Fighter One/Hero:')).toBeTruthy();
    expect(container.querySelector('main')?.getAttribute('aria-busy')).toBe('false');
  });

  it('ignores a result from a destination that was superseded while loading', () => {
    vi.useFakeTimers();
    mocks.useLiveQuery.mockReturnValue({ data: pageSnapshot(), error: null });
    const { rerender } = render(<App />);
    act(() => vi.advanceTimersByTime(650));
    act(() => useAppStore.getState().setSelectedGame('game-1'));
    act(() => useAppStore.getState().setSelectedGame('game-2'));
    mocks.useLiveQuery.mockReturnValue({ data: pageSnapshot('game-1'), error: null });
    rerender(<App />);
    expect(screen.getByText('Games: Fighter One')).toBeTruthy();
    expect(screen.queryByText('Characters for Fighter One: Hero')).toBeNull();
  });

  it('delegates an available update to the updater controller', () => {
    const showAvailableUpdate = vi.fn();
    mocks.useUpdater.mockReturnValue({
      status: updateSnapshot({ status: 'available', update: updateDetails({ version: '2.0.0', changelog: 'Important fixes' }) }),
      availabilityEventId: 1,
      showAvailableUpdate,
    });

    render(<App />);

    expect(mocks.toastInfo).toHaveBeenCalledWith(
      'Update v2.0.0 available',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'View' }),
      }),
    );
    const toastOptions = mocks.toastInfo.mock.calls[0][1] as {
      action: { onClick: () => void };
    };
    act(() => toastOptions.action.onClick());

    expect(showAvailableUpdate).toHaveBeenCalledTimes(1);
  });

  it('delegates portable update presentation to the same controller', () => {
    const showAvailableUpdate = vi.fn();
    mocks.useUpdater.mockReturnValue({
      status: updateSnapshot({ status: 'available', update: updateDetails({ version: '2.0.0', changelog: 'Portable fixes', isPortable: true }) }),
      availabilityEventId: 1,
      showAvailableUpdate,
    });
    render(<App />);

    expect(mocks.toastInfo).toHaveBeenCalledWith(
      'Update v2.0.0 available',
      expect.objectContaining({ action: expect.objectContaining({ label: 'View' }) }),
    );
    const toastOptions = mocks.toastInfo.mock.calls[0][1] as {
      action: { onClick: () => void };
    };
    act(() => toastOptions.action.onClick());
    expect(showAvailableUpdate).toHaveBeenCalledTimes(1);
  });
});
