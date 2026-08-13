import {
  ArrowSquareOutIcon,
  CaretDownIcon,
  InfoIcon,
  NotePencilIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useState,
} from 'react';
import { toast } from 'sonner';
import { NotesMarkdown } from '@/components/shared/NotesMarkdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { CharacterLink } from '@/lib/types';

export interface CharacterInfoCardRef {
  openAddLinkForm: () => void;
}

interface CharacterInfoCardProps {
  characterId: string;
  notes: string;
  links: CharacterLink[];
  isOpen: boolean;
  onToggle: () => void;
  onEditNote: () => void;
}

function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return '';
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export const CharacterInfoCard = forwardRef<
  CharacterInfoCardRef,
  CharacterInfoCardProps
>(function CharacterInfoCard(
  { characterId, notes, links, isOpen, onToggle, onEditNote },
  ref,
) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editUrlDraft, setEditUrlDraft] = useState('');
  const [editLabelDraft, setEditLabelDraft] = useState('');
  const urlInputId = useId();
  const labelInputId = useId();
  const editUrlInputId = useId();
  const editLabelInputId = useId();

  const cancelAdd = useCallback(() => {
    setShowAddForm(false);
    setUrlDraft('');
    setLabelDraft('');
  }, []);

  const startEditLink = useCallback((link: CharacterLink) => {
    setEditingLinkId(link.id);
    setEditUrlDraft(link.url);
    setEditLabelDraft(link.label);
  }, []);

  const cancelEditLink = useCallback(() => {
    setEditingLinkId(null);
    setEditUrlDraft('');
    setEditLabelDraft('');
  }, []);

  const handleSaveEdit = useCallback(
    async (id: string) => {
      const raw = editUrlDraft.trim();
      if (!raw) return;
      const normalized = normalizeUrl(raw);
      try {
        new URL(normalized);
      } catch {
        toast.error('Invalid URL');
        return;
      }
      try {
        await indexedDbStorage.characters.update(characterId, {
          links: links.map((l) =>
            l.id === id
              ? {
                  ...l,
                  url: normalized,
                  label: editLabelDraft.trim() || getDomain(normalized),
                }
              : l,
          ),
        });
        cancelEditLink();
      } catch {
        toast.error('Failed to update link');
      }
    },
    [characterId, links, editUrlDraft, editLabelDraft, cancelEditLink],
  );

  useImperativeHandle(ref, () => ({
    openAddLinkForm: () => setShowAddForm(true),
  }));

  const handleAdd = useCallback(async () => {
    const raw = urlDraft.trim();
    if (!raw) return;

    const normalized = normalizeUrl(raw);
    try {
      new URL(normalized);
    } catch {
      toast.error('Invalid URL');
      return;
    }

    const newLink: CharacterLink = {
      id: crypto.randomUUID(),
      url: normalized,
      label: labelDraft.trim() || getDomain(normalized),
    };

    try {
      await indexedDbStorage.characters.update(characterId, {
        links: [...links, newLink],
      });
      cancelAdd();
    } catch {
      toast.error('Failed to add link');
    }
  }, [characterId, links, urlDraft, labelDraft, cancelAdd]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await indexedDbStorage.characters.update(characterId, {
          links: links.filter((l) => l.id !== id),
        });
      } catch {
        toast.error('Failed to remove link');
      }
    },
    [characterId, links],
  );

  const hasNotes = Boolean(notes?.trim());
  const hasLinks = links.length > 0;

  if (!hasNotes && !hasLinks && !showAddForm) return null;

  return (
    <div className="mb-6 border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center justify-between px-1 py-1 rounded hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-base font-semibold text-foreground">
            <InfoIcon className="w-5 h-5" />
            Character Info
            {hasLinks && (
              <span className="text-xs font-normal text-muted-foreground/60">
                {links.length} {links.length === 1 ? 'link' : 'links'}
              </span>
            )}
          </span>
          <CaretDownIcon
            className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {isOpen && (
        <div className="bg-muted/30 p-3 flex flex-col gap-3">
          {/* Notes inner card */}
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onEditNote}
                title="Edit note"
                className="h-6 px-1.5"
              >
                <NotePencilIcon className="w-3.5 h-3.5" />
                <span className="sr-only">Edit note</span>
              </Button>
            </div>
            {hasNotes ? (
              <div className="px-3 pb-2.5">
                <NotesMarkdown content={notes} />
              </div>
            ) : (
              <p className="px-3 pb-2.5 text-xs text-muted-foreground/60 italic">
                No notes yet.
              </p>
            )}
          </div>

          {/* Resources inner card */}
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resources
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(true)}
                title="Add resource link"
                className="h-6 px-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span className="sr-only">Add resource link</span>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
              {links.map((link) =>
                editingLinkId === link.id ? (
                  // Inline edit form
                  <div
                    key={link.id}
                    className="space-y-3 rounded-md border border-border bg-muted/20 p-3 sm:col-span-2"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={editUrlInputId} className="text-xs">
                        URL
                      </Label>
                      <Input
                        id={editUrlInputId}
                        type="url"
                        value={editUrlDraft}
                        onChange={(e) => setEditUrlDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSaveEdit(link.id);
                          if (e.key === 'Escape') cancelEditLink();
                        }}
                        autoFocus
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={editLabelInputId} className="text-xs">
                        Label
                      </Label>
                      <Input
                        id={editLabelInputId}
                        value={editLabelDraft}
                        onChange={(e) => setEditLabelDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSaveEdit(link.id);
                          if (e.key === 'Escape') cancelEditLink();
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditLink}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleSaveEdit(link.id)}
                        disabled={!editUrlDraft.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Normal link row
                  <div
                    key={link.id}
                    className="flex min-w-0 items-center overflow-hidden rounded-md border border-border bg-background/40"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${link.label} in a new tab`}
                      className="flex min-w-0 flex-1 self-stretch items-center gap-3 rounded-l-md px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <img
                        src={getFaviconUrl(link.url)}
                        alt=""
                        aria-hidden="true"
                        className="h-6 w-6 shrink-0 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {link.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {getDomain(link.url)}
                        </span>
                      </span>
                      <ArrowSquareOutIcon
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                      />
                    </a>
                    <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 px-1">
                      <button
                        type="button"
                        onClick={() => startEditLink(link)}
                        title="Edit link"
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <PencilSimpleIcon className="h-4 w-4" />
                        <span className="sr-only">Edit {link.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(link.id)}
                        title="Remove link"
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span className="sr-only">Remove {link.label}</span>
                      </button>
                    </div>
                  </div>
                ),
              )}

              {showAddForm && (
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3 sm:col-span-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={urlInputId} className="text-xs">
                      URL
                    </Label>
                    <Input
                      id={urlInputId}
                      type="url"
                      placeholder="https://dustloop.com/..."
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAdd();
                        if (e.key === 'Escape') cancelAdd();
                      }}
                      autoFocus
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={labelInputId} className="text-xs">
                      Label{' '}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id={labelInputId}
                      placeholder="Dustloop Wiki"
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAdd();
                        if (e.key === 'Escape') cancelAdd();
                      }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelAdd}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleAdd()}
                      disabled={!urlDraft.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
