import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { useAppStore } from '@/lib/store';

const mocks = vi.hoisted(() => ({
  useLiveQuery: vi.fn(),
  useSettings: vi.fn(),
  useUpdater: vi.fn(),
  toastInfo: vi.fn(),
  reportError: vi.fn(),
  gamesGetAll: vi.fn(),
  charactersGetByGame: vi.fn(),
  combosGetByCharacter: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (...args: unknown[]) => mocks.useLiveQuery(...args),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => mocks.useSettings(),
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

function installElectronApi(overrides: Partial<Window['electronAPI']> = {}) {
  window.electronAPI = {
    platform: 'win32',
    versions: { electron: '40', chrome: '140', node: '22' },
    checkForUpdate: vi.fn(),
    downloadUpdate: vi.fn(),
    cancelUpdate: vi.fn(),
    installUpdate: vi.fn(),
    getUpdateStatus: vi.fn(),
    setAutoCheck: vi.fn().mockResolvedValue(undefined),
    getAppVersion: vi.fn(),
    getCurrentChangelog: vi.fn(),
    onUpdateChecking: vi.fn(() => () => {}),
    onUpdateAvailable: vi.fn(() => () => {}),
    onUpdateNotAvailable: vi.fn(() => () => {}),
    onUpdateError: vi.fn(() => () => {}),
    onDownloadProgress: vi.fn(() => () => {}),
    onUpdateDownloaded: vi.fn(() => () => {}),
    onUpdateCancelled: vi.fn(() => () => {}),
    saveFile: vi.fn(),
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
    mocks.useUpdater.mockReturnValue({
      status: { status: 'idle' },
      availabilityEventId: 0,
      downloadUpdate: vi.fn(),
    });
    mocks.useLiveQuery.mockImplementation(
      (_query: unknown, dependencies: unknown[]) => {
        if (dependencies.length === 0) return queryData.games;
        if (dependencies.length === 1) return queryData.characters;
        return queryData.combos;
      },
    );
    installElectronApi();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--app-font-family');
    document.documentElement.style.removeProperty('--accent-color');
  });

  it('routes from games to characters to combos using the selected entities', () => {
    render(<App />);

    expect(screen.getByText('Games: Fighter One')).toBeTruthy();

    act(() => useAppStore.getState().setSelectedGame('game-1'));
    expect(screen.getByText('Characters for Fighter One: Hero')).toBeTruthy();

    act(() => useAppStore.getState().setSelectedCharacter('character-1'));
    expect(
      screen.getByText('Combos for Fighter One/Hero: Starter'),
    ).toBeTruthy();
    expect(mocks.useLiveQuery).toHaveBeenCalledWith(
      expect.any(Function),
      ['character-1', DEFAULT_SETTINGS.parsedNotationVersion],
    );
  });

  it('shows controller updates and starts the download', async () => {
    const downloadUpdate = vi.fn().mockResolvedValue({
      success: true,
      data: null,
      error: null,
    });
    mocks.useUpdater.mockReturnValue({
      status: {
        status: 'available',
        version: '2.0.0',
        changelog: 'Important fixes',
        isPortable: false,
      },
      availabilityEventId: 1,
      downloadUpdate,
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

    expect(screen.getByText(/Changelog 2\.0\.0: Important fixes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Install update' }));
    expect(downloadUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Downloading update 2.0.0')).toBeTruthy();
  });

  it('opens portable release downloads without showing installer progress', async () => {
    const downloadUpdate = vi.fn().mockResolvedValue({
      success: true,
      data: null,
      error: null,
    });
    mocks.useUpdater.mockReturnValue({
      status: {
        status: 'available',
        version: '2.0.0',
        changelog: 'Portable fixes',
        isPortable: true,
      },
      availabilityEventId: 1,
      downloadUpdate,
    });
    render(<App />);

    const toastOptions = mocks.toastInfo.mock.calls[0][1] as {
      action: { onClick: () => void };
    };
    act(() => toastOptions.action.onClick());
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Download Page' }),
    );

    await waitFor(() => expect(downloadUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Downloading update/)).toBeNull();
  });
});
