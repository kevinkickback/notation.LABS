import { act, createRef, type ReactElement, useState } from 'react';
import { fireEvent, render as renderComponent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityNotebook, type EntityNotebookRef, NotebookWorkspace } from '@/components/shared/EntityNotebook';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SettingsProvider } from '@/context/SettingsContext';
import { updateCharacter } from '@/lib/application/characterCommands';
import { updateGame } from '@/lib/application/gameCommands';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { useNotebookOpen } from '@/hooks/useNotebookOpen';
import type { CharacterLink, UserSettings } from '@/lib/types';

const preferences = vi.hoisted(() => ({ saved: {} as UserSettings, update: vi.fn(), openUpdate: vi.fn() }));
vi.mock('@/hooks/useRecoverableLiveQuery', () => ({
  useRecoverableLiveQuery: () => ({ data: { settings: preferences.saved, appliedThrough: 0 }, error: null }),
}));
vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: { settings: {
    // Startup is covered separately; keep its mount update out of notebook interactions.
    init: () => new Promise<void>(() => {}),
    get: async () => preferences.saved,
    update: (...args: unknown[]) => preferences.update(...args),
    setNotebookOpen: (...args: unknown[]) => preferences.openUpdate(...args),
  } },
}));

vi.mock('@/lib/application/characterCommands', () => ({ updateCharacter: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/application/gameCommands', () => ({ updateGame: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/errors', () => ({ reportError: vi.fn(), toUserMessage: (error: Error) => error.message }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function render(ui: ReactElement) {
  return renderComponent(ui, { wrapper: SettingsProvider });
}

const links: CharacterLink[] = [
  { id: 'wiki', url: 'https://dustloop.com', label: 'Dustloop Wiki' },
  { id: 'video', url: 'https://example.com', label: 'Video guide' },
];

function CharacterNotebook({ notes = '', resources = links, initiallyOpen = true }: { notes?: string; resources?: CharacterLink[]; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <NotebookWorkspace><EntityNotebook kind="character" entityId="ryu" entityName="Ryu" notes={notes} links={resources} isOpen={open} onToggle={() => setOpen(value => !value)} /></NotebookWorkspace>;
}

function RememberedCharacterNotebook() {
  const [open, toggle] = useNotebookOpen('ryu');
  return <NotebookWorkspace><EntityNotebook kind="character" entityId="ryu" entityName="Ryu" notes="Practice" links={[]} isOpen={open} onToggle={toggle} /></NotebookWorkspace>;
}

describe('EntityNotebook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferences.saved = { ...DEFAULT_SETTINGS };
    preferences.update.mockImplementation(async (updates: Partial<UserSettings>) => {
      preferences.saved = { ...preferences.saved, ...updates };
    });
    vi.mocked(updateCharacter).mockResolvedValue(undefined);
    vi.mocked(updateGame).mockResolvedValue(undefined);
  });

  it('keeps a discoverable entry point when there is no saved content', async () => {
    const user = userEvent.setup();
    render(<CharacterNotebook resources={[]} initiallyOpen={false} />);
    const toggle = screen.getByRole('button', { name: 'Notes & Resources' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Nothing saved yet.')).toBeNull();
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).not.toBeNull();
    expect(screen.getByText('Nothing saved yet.')).not.toBeNull();
    const add = screen.getByRole('button', { name: 'Add note' });
    expect(add.textContent).toBe('Add');
    expect(screen.getByRole('region', { name: 'Notes' }).contains(add)).toBe(true);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    const resources = screen.getByRole('region', { name: 'Resources' });
    expect(within(resources).getByText('Nothing saved yet.')).not.toBeNull();
    const addResource = within(resources).getByRole('button', { name: 'Add resource link' });
    expect(addResource.textContent).toBe('Add');
    expect(screen.queryByRole('heading', { name: 'Resources' })).toBeNull();
  });

  it('renders formatted notes and safe, accessible resource links', async () => {
    const user = userEvent.setup();
    render(<CharacterNotebook notes="Practice **punishes**" />);
    expect(screen.getByText('punishes').tagName).toBe('STRONG');
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    const link = screen.getByRole('link', { name: 'Open Dustloop Wiki in a new tab' });
    expect(link.getAttribute('href')).toBe('https://dustloop.com');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('dustloop.com')).not.toBeNull();
  });

  it('keeps focus in Settings when the notebook opens underneath it', () => {
    render(<Dialog open><DialogContent><DialogTitle>Settings</DialogTitle><DialogDescription>Preferences</DialogDescription><button type="button">Done</button></DialogContent></Dialog>);
    const done = screen.getByRole('button', { name: 'Done' });
    done.focus();
    render(<CharacterNotebook notes="Practice reminders" />);
    expect(document.activeElement).toBe(done);
    expect(screen.getByRole('dialog', { name: 'Ryu Notebook' })).not.toBeNull();
  });

  it('keeps the floating notebook inside the page interaction boundary', () => {
    render(<main inert><CharacterNotebook /></main>);
    const drawer = screen.getByRole('dialog', { name: 'Ryu Notebook' });
    expect(drawer.closest('main')?.hasAttribute('inert')).toBe(true);
    expect(drawer.closest('.notebook-workspace')).not.toBeNull();
  });

  it.each([false, true])('returns focus to the opener if saving an optimistic open fails with docked=%s', async notebookDocked => {
    const mediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...window.matchMedia('(min-width: 1100px)'), matches: true });
    try {
      preferences.saved = { ...DEFAULT_SETTINGS, notebookDocked };
      let rejectOpen!: (error: Error) => void;
      preferences.openUpdate.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectOpen = reject; }));
      const user = userEvent.setup();
      render(<RememberedCharacterNotebook />);
      const toggle = screen.getByRole('button', { name: 'Notes & Resources' });
      await user.click(toggle);
      const role = notebookDocked ? 'complementary' : 'dialog';
      const drawer = screen.getByRole(role, { name: 'Ryu Notebook' });
      expect(drawer.contains(document.activeElement)).toBe(true);
      await act(async () => rejectOpen(new Error('Storage unavailable')));
      await waitFor(() => expect(screen.queryByRole(role)).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(toggle));
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    } finally {
      mediaSpy.mockRestore();
    }
  });

  it.each([false, true])('preserves existing focus when restoring a notebook with docked=%s', notebookDocked => {
    const mediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...window.matchMedia('(min-width: 1100px)'), matches: true });
    try {
      preferences.saved = { ...DEFAULT_SETTINGS, notebookDocked };
      render(<button type="button">Keep focus</button>);
      const control = screen.getByRole('button', { name: 'Keep focus' });
      control.focus();
      render(<CharacterNotebook />);
      expect(document.activeElement).toBe(control);
    } finally {
      mediaSpy.mockRestore();
    }
  });

  it('preserves the note draft through preview and closing', async () => {
    const user = userEvent.setup();
    render(<CharacterNotebook notes="Old note" />);
    const edit = screen.getByRole('button', { name: 'Edit note' });
    expect(screen.getByRole('region', { name: 'Notes' }).contains(edit)).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Notes' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit note' }));
    await user.clear(screen.getByRole('textbox', { name: 'Note' }));
    await user.type(screen.getByRole('textbox', { name: 'Note' }), '**New** note');
    expect(screen.getByRole('button', { name: 'Save Note' }).textContent).toBe('Save');
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText('New').tagName).toBe('STRONG');
    const drawer = screen.getByRole('dialog', { name: 'Ryu Notebook' });
    await user.click(within(drawer).getByRole('tab', { name: 'Write' }));
    expect((screen.getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement).value).toBe('**New** note');
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Notes & Resources' }));
    expect((screen.getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement).value).toBe('**New** note');
    await user.click(screen.getByRole('button', { name: 'Save Note' }));
    expect(updateCharacter).toHaveBeenCalledWith('ryu', { notes: '**New** note' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit note' }));
  });

  it('cancels note edits without writing and starts the next edit from saved content', async () => {
    const user = userEvent.setup();
    render(<CharacterNotebook notes="Saved note" />);
    await user.click(screen.getByRole('button', { name: 'Edit note' }));
    await user.type(screen.getByRole('textbox', { name: 'Note' }), ' draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(updateCharacter).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit note' }));
    await user.click(screen.getByRole('button', { name: 'Edit note' }));
    expect((screen.getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement).value).toBe('Saved note');
  });

  it('docks and undocks without losing drafts, and keeps the docking choice when reopened', async () => {
    const originalMedia = window.matchMedia('(min-width: 1100px)');
    const mediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...originalMedia, matches: true });
    try {
      const user = userEvent.setup();
      render(<CharacterNotebook notes="Saved note" resources={[]} />);
      await user.click(screen.getByRole('button', { name: 'Edit note' }));
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Note' }));
      await user.clear(screen.getByRole('textbox', { name: 'Note' }));
      await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Docked draft');
      await user.click(screen.getByRole('button', { name: 'Dock' }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undock' }));
      const dock = screen.getByRole('complementary', { name: 'Ryu Notebook' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect((within(dock).getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement).value).toBe('Docked draft');
      await user.click(within(dock).getByRole('tab', { name: 'Resources (0)' }));
      await user.click(within(dock).getByRole('button', { name: 'Add resource link' }));
      await user.type(screen.getByRole('textbox', { name: 'URL' }), 'https://example.com/draft');
      await user.click(within(dock).getByRole('button', { name: 'Undock' }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dock' }));
      expect((screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement).value).toBe('https://example.com/draft');
      await user.click(screen.getByRole('button', { name: 'Dock' }));
      await user.click(screen.getByRole('button', { name: 'Close notebook' }));
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Notes & Resources' }));
      await user.click(screen.getByRole('button', { name: 'Notes & Resources' }));
      expect(screen.getByRole('complementary', { name: 'Ryu Notebook' })).not.toBeNull();
      expect((screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement).value).toBe('https://example.com/draft');
      expect(updateCharacter).not.toHaveBeenCalled();
    } finally {
      mediaSpy.mockRestore();
    }
  });

  it('hides docking controls and their spacing in narrow windows', () => {
    render(<CharacterNotebook />);
    expect(screen.queryByRole('button', { name: 'Dock' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undock' })).toBeNull();
    expect(screen.getByRole('dialog').querySelector('.notebook-panel-tools')?.children).toHaveLength(1);
  });

  it('restores saved docking across remounts for game and character notebooks and saves undocking', async () => {
    const mediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...window.matchMedia('(min-width: 1100px)'), matches: true });
    try {
      const user = userEvent.setup();
      const first = render(<CharacterNotebook />);
      await user.click(screen.getByRole('button', { name: 'Dock' }));
      await waitFor(() => expect(preferences.update).toHaveBeenCalledWith({ notebookDocked: true }));
      first.unmount();
      const second = render(<NotebookWorkspace><EntityNotebook kind="game" entityId="sf6" entityName="Street Fighter 6" notes="Game plan" isOpen onToggle={vi.fn()} /></NotebookWorkspace>);
      expect(screen.getByRole('complementary', { name: 'Street Fighter 6 Notebook' })).not.toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Undock' }));
      await waitFor(() => expect(preferences.update).toHaveBeenCalledWith({ notebookDocked: false }));
      second.unmount();
      render(<CharacterNotebook />);
      expect(screen.getByRole('dialog', { name: 'Ryu Notebook' })).not.toBeNull();
      expect(screen.queryByRole('complementary')).toBeNull();
    } finally {
      mediaSpy.mockRestore();
    }
  });

  it('returns to the saved mode when persisting a docking change fails', async () => {
    const mediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...window.matchMedia('(min-width: 1100px)'), matches: true });
    try {
      const user = userEvent.setup();
      preferences.update.mockRejectedValueOnce(new Error('Storage unavailable'));
      render(<CharacterNotebook />);
      await user.click(screen.getByRole('button', { name: 'Dock' }));
      await waitFor(() => expect(screen.getByRole('dialog', { name: 'Ryu Notebook' })).not.toBeNull());
      expect(preferences.saved.notebookDocked).toBe(false);
      expect(screen.queryByRole('complementary')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dock' })));
    } finally {
      mediaSpy.mockRestore();
    }
  });

  it('shares adjusted width across game and character remounts and persists its reset', async () => {
    const mediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...window.matchMedia('(min-width: 1100px)'), matches: true });
    try {
      preferences.saved = { ...DEFAULT_SETTINGS, notebookDocked: true };
      const user = userEvent.setup();
      const first = render(<CharacterNotebook />);
      const handle = screen.getByRole('separator', { name: 'Notebook width' });
      handle.focus();
      await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
      await waitFor(() => expect(preferences.saved.notebookDockWidth).toBe(450));
      first.unmount();
      const second = render(<NotebookWorkspace><EntityNotebook kind="game" entityId="sf6" entityName="Street Fighter 6" notes="" isOpen onToggle={vi.fn()} /></NotebookWorkspace>);
      expect(screen.getByRole('separator', { name: 'Notebook width' }).getAttribute('aria-valuenow')).toBe('450');
      fireEvent.doubleClick(screen.getByRole('separator', { name: 'Notebook width' }));
      await waitFor(() => expect(preferences.saved.notebookDockWidth).toBe(400));
      second.unmount();
      render(<CharacterNotebook />);
      expect(screen.getByRole('separator', { name: 'Notebook width' }).getAttribute('aria-valuenow')).toBe('400');
    } finally {
      mediaSpy.mockRestore();
    }
  });

  it('restores the saved width if its update fails', async () => {
    const mediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...window.matchMedia('(min-width: 1100px)'), matches: true });
    try {
      preferences.saved = { ...DEFAULT_SETTINGS, notebookDocked: true, notebookDockWidth: 450 };
      preferences.update.mockRejectedValueOnce(new Error('Storage unavailable'));
      const user = userEvent.setup();
      render(<CharacterNotebook />);
      const handle = screen.getByRole('separator', { name: 'Notebook width' });
      handle.focus();
      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(preferences.update).toHaveBeenCalledWith({ notebookDockWidth: 470 }));
      await waitFor(() => expect(handle.getAttribute('aria-valuenow')).toBe('450'));
      expect(preferences.saved.notebookDockWidth).toBe(450);
    } finally {
      mediaSpy.mockRestore();
    }
  });

  it('keeps a plain constant label without indicators as saved content changes', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<EntityNotebook kind="character" entityId="ryu" entityName="Ryu" notes="" links={[]} isOpen={false} onToggle={onToggle} />);
    for (const content of [
      { notes: '', links: [], hasContent: false },
      { notes: '   ', links: [], hasContent: false },
      { notes: 'Practice punishes', links: [], hasContent: true },
      { notes: '', links, hasContent: true },
      { notes: 'Practice punishes', links, hasContent: true },
      { notes: '', links: [], hasContent: false },
    ]) {
      rerender(<EntityNotebook kind="character" entityId="ryu" entityName="Ryu" notes={content.notes} links={content.links} isOpen={false} onToggle={onToggle} />);
      const toggle = screen.getByRole('button', { name: 'Notes & Resources' });
      expect(toggle.textContent).toBe('Notes & Resources');
      expect(toggle.querySelector('.notebook-content-indicator')).toBeNull();
      expect(toggle.getAttribute('aria-describedby')).toBeNull();
      expect(toggle.getAttribute('title')).toBeNull();
    }
  });

  it('keeps the game notes button plain with or without a saved note', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<EntityNotebook kind="game" entityId="sf6" entityName="Street Fighter 6" notes="" isOpen={false} onToggle={onToggle} />);
    const toggle = screen.getByRole('button', { name: 'Notes' });
    expect(toggle.textContent).toBe('Notes');
    rerender(<EntityNotebook kind="game" entityId="sf6" entityName="Street Fighter 6" notes="Practice anti-airs" isOpen={false} onToggle={onToggle} />);
    expect(toggle.textContent).toBe('Notes');
    expect(toggle.querySelector('.notebook-content-indicator')).toBeNull();
    expect(toggle.getAttribute('title')).toBeNull();
  });

  it('adjusts dock width with the keyboard, clamps the range, and remembers it when reopened', async () => {
    const originalMedia = window.matchMedia('(min-width: 1100px)');
    const mediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ ...originalMedia, matches: true });
    try {
      const user = userEvent.setup();
      render(<CharacterNotebook />);
      expect(screen.queryByRole('button', { name: 'Reference' })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Dock' }));
      const handle = screen.getByRole('separator', { name: 'Notebook width' });
      handle.focus();
      expect(handle.getAttribute('aria-valuenow')).toBe('400');
      await user.keyboard('{ArrowLeft}');
      expect(handle.getAttribute('aria-valuenow')).toBe('420');
      await user.keyboard('{End}{ArrowLeft}');
      expect(handle.getAttribute('aria-valuenow')).toBe('600');
      await user.keyboard('{Home}{ArrowRight}');
      expect(handle.getAttribute('aria-valuenow')).toBe('320');
      await user.keyboard('{ArrowLeft}');
      await user.click(screen.getByRole('button', { name: 'Close notebook' }));
      await user.click(screen.getByRole('button', { name: 'Notes & Resources' }));
      expect(screen.getByRole('separator', { name: 'Notebook width' }).getAttribute('aria-valuenow')).toBe('340');
      fireEvent.doubleClick(screen.getByRole('separator', { name: 'Notebook width' }));
      expect(screen.getByRole('separator', { name: 'Notebook width' }).getAttribute('aria-valuenow')).toBe('400');
      await waitFor(() => expect(preferences.saved.notebookDockWidth).toBe(400));
    } finally {
      mediaSpy.mockRestore();
    }
  });

  it('keeps a failed note save editable', async () => {
    vi.mocked(updateCharacter).mockRejectedValueOnce(new Error('Write failed'));
    const user = userEvent.setup();
    render(<CharacterNotebook resources={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Save Note' }));
    expect((screen.getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement).value).toBe('Keep this draft');
    expect((screen.getByRole('button', { name: 'Save Note' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('saves game notes with the same editor and no character resource controls', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EntityNotebook kind="game" entityId="sf6" entityName="Street Fighter 6" notes="" isOpen onToggle={vi.fn()} />);
    const drawer = screen.getByRole('dialog', { name: 'Street Fighter 6 Notebook' });
    expect(within(drawer).getAllByRole('heading', { name: 'Notes' })).toHaveLength(1);
    expect(within(drawer).getByText('Nothing saved yet.')).not.toBeNull();
    expect(within(drawer).queryByText('No notes yet.')).toBeNull();
    expect(within(drawer).getByRole('button', { name: 'Add note' }).textContent).toBe('Add');
    expect(within(drawer).getByRole('region', { name: 'Notes' }).contains(within(drawer).getByRole('button', { name: 'Add note' }))).toBe(true);
    expect(drawer.querySelector('.notebook-panel-toolbar')?.contains(within(drawer).getByRole('button', { name: 'Add note' }))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Add resource link' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByRole('textbox', { name: 'Note' }), '  Game strategy  ');
    expect(within(drawer).getAllByRole('heading', { name: 'Notes' })).toHaveLength(1);
    expect(within(drawer).queryByRole('heading', { name: 'Edit Note' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save Note' }).textContent).toBe('Save');
    await user.click(screen.getByRole('button', { name: 'Save Note' }));
    expect(updateGame).toHaveBeenCalledWith('sf6', { notes: 'Game strategy' });
    expect(updateCharacter).not.toHaveBeenCalled();
    rerender(<EntityNotebook kind="game" entityId="sf6" entityName="Street Fighter 6" notes="Game strategy" isOpen onToggle={vi.fn()} />);
    const edit = within(drawer).getByRole('button', { name: 'Edit note' });
    expect(within(drawer).getByRole('region', { name: 'Notes' }).contains(edit)).toBe(true);
    expect(drawer.querySelector('.notebook-panel-toolbar')?.contains(edit)).toBe(false);
  });

  it('adds a resource with an optional label and normalized URL', async () => {
    const user = userEvent.setup();
    render(<CharacterNotebook resources={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    await user.click(screen.getByRole('button', { name: 'Add resource link' }));
    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'dustloop.com');
    await user.click(screen.getByRole('button', { name: 'Add resource' }));
    expect(updateCharacter).toHaveBeenCalledWith('ryu', { links: [expect.objectContaining({ url: 'https://dustloop.com', label: 'dustloop.com' })] });
    expect(screen.queryByRole('textbox', { name: 'URL' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add resource link' }));
  });

  it.each(['javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com', 'not a url'])('rejects the unsafe or malformed URL %s without losing the draft', async url => {
    const user = userEvent.setup();
    render(<CharacterNotebook resources={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    await user.click(screen.getByRole('button', { name: 'Add resource link' }));
    await user.type(screen.getByRole('textbox', { name: 'URL' }), url);
    await user.click(screen.getByRole('button', { name: 'Add resource' }));
    expect(screen.getByRole('alert').textContent).toContain('HTTP or HTTPS');
    expect(updateCharacter).not.toHaveBeenCalled();
    expect((screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement).value).toBe(url);
  });

  it.each(['localhost:3000/guide', 'example.com:8080/guide'])('saves the schemeless host and port %s as HTTPS', async url => {
    const user = userEvent.setup();
    render(<CharacterNotebook resources={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    await user.click(screen.getByRole('button', { name: 'Add resource link' }));
    await user.type(screen.getByRole('textbox', { name: 'URL' }), url);
    await user.click(screen.getByRole('button', { name: 'Add resource' }));
    expect(updateCharacter).toHaveBeenCalledWith('ryu', { links: [expect.objectContaining({ url: `https://${url}` })] });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('edits a resource while preserving its identity and other resources', async () => {
    const user = userEvent.setup();
    render(<CharacterNotebook />);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    await user.click(screen.getByRole('button', { name: 'Edit Dustloop Wiki' }));
    await user.clear(screen.getByRole('textbox', { name: /Label/ }));
    await user.type(screen.getByRole('textbox', { name: /Label/ }), 'Frame data');
    await user.click(screen.getByRole('button', { name: 'Save resource' }));
    expect(updateCharacter).toHaveBeenCalledWith('ryu', { links: [{ ...links[0], label: 'Frame data' }, links[1]] });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Dustloop Wiki' }));
  });

  it('cancels resource edits without writing', async () => {
    const user = userEvent.setup();
    render(<CharacterNotebook />);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    await user.click(screen.getByRole('button', { name: 'Edit Dustloop Wiki' }));
    await user.type(screen.getByRole('textbox', { name: /Label/ }), ' unsaved');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(updateCharacter).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Open Dustloop Wiki in a new tab' })).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Dustloop Wiki' }));
  });

  it('preserves a resource draft across closing and failed saves', async () => {
    vi.mocked(updateCharacter).mockRejectedValueOnce(new Error('Write failed'));
    const user = userEvent.setup();
    render(<CharacterNotebook resources={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    await user.click(screen.getByRole('button', { name: 'Add resource link' }));
    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Notes & Resources' }));
    expect((screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement).value).toBe('https://example.com');
    await user.click(screen.getByRole('button', { name: 'Add resource' }));
    expect((screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement).value).toBe('https://example.com');
  });

  it('removes only the selected resource and handles a failed removal', async () => {
    const user = userEvent.setup();
    render(<CharacterNotebook />);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    await user.click(screen.getByRole('button', { name: 'Remove Dustloop Wiki' }));
    expect(updateCharacter).toHaveBeenCalledWith('ryu', { links: [links[1]] });
    vi.mocked(updateCharacter).mockRejectedValueOnce(new Error('Write failed'));
    await user.click(screen.getByRole('button', { name: 'Remove Dustloop Wiki' }));
    expect(screen.getByRole('link', { name: 'Open Dustloop Wiki in a new tab' })).not.toBeNull();
  });

  it('opens the note editor from the original empty-page action even when collapsed', async () => {
    const user = userEvent.setup();
    const ref = createRef<EntityNotebookRef>();
    const onToggle = vi.fn();
    const { rerender } = render(<EntityNotebook ref={ref} kind="character" entityId="ryu" entityName="Ryu" notes="" links={[]} isOpen={false} onToggle={onToggle} />);
    act(() => ref.current?.editNote());
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<EntityNotebook ref={ref} kind="character" entityId="ryu" entityName="Ryu" notes="" links={[]} isOpen onToggle={onToggle} />);
    expect(screen.getByRole('textbox', { name: 'Note' })).not.toBeNull();
    screen.getByRole('button', { name: 'Save Note' }).focus();
    act(() => ref.current?.editNote());
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Note' }));
    await user.click(screen.getByRole('tab', { name: 'Resources (0)' }));
    await user.click(screen.getByRole('button', { name: 'Add resource link' }));
    expect(screen.getByRole('textbox', { name: 'URL' })).not.toBeNull();
  });

  it('uses site favicons with a stable fallback and retries after the resource URL changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CharacterNotebook resources={[links[0]]} />);
    await user.click(screen.getByRole('tab', { name: /^Resources/ }));
    const link = screen.getByRole('link', { name: 'Open Dustloop Wiki in a new tab' });
    const favicon = link.querySelector('img');
    if (!favicon) throw new Error('Missing resource favicon');
    expect(favicon.getAttribute('src')).toBe('https://www.google.com/s2/favicons?domain=dustloop.com&sz=32');
    expect(favicon.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(favicon.getAttribute('alt')).toBe('');
    fireEvent.error(favicon);
    expect(link.querySelector('img')).toBeNull();
    expect(link.querySelector('.notebook-resource-favicon svg')).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://dustloop.com');
    rerender(<CharacterNotebook resources={[{ ...links[0], url: 'https://example.org/private/path?query=practice' }]} />);
    expect(link.querySelector('img')?.getAttribute('src')).toBe('https://www.google.com/s2/favicons?domain=example.org&sz=32');
  });
});
