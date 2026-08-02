import {
  ArrowSquareOutIcon,
  CaretDownIcon,
  LinkSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { CharacterLink } from '@/lib/types';

interface CharacterLinksProps {
  characterId: string;
  links: CharacterLink[];
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

export function CharacterLinks({ characterId, links }: CharacterLinksProps) {
  const [isOpen, setIsOpen] = useState(links.length > 0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const urlInputId = useId();
  const labelInputId = useId();

  const cancelAdd = useCallback(() => {
    setShowAddForm(false);
    setUrlDraft('');
    setLabelDraft('');
  }, []);

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
      setIsOpen(true);
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

  const openAddForm = useCallback(() => {
    setShowAddForm(true);
    setIsOpen(true);
  }, []);

  // When no links exist and form isn't open, show a subtle inline prompt
  if (links.length === 0 && !showAddForm) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={openAddForm}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add resource link
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 border border-border rounded-lg overflow-hidden">
      {/* Header row matching ComboViewNotes style */}
      <div className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-card border-b border-border">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="flex-1 min-w-0 flex items-center justify-between px-2 py-1 rounded hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <LinkSimpleIcon className="w-4 h-4" />
            Resources
            {links.length > 0 && (
              <span className="text-xs text-muted-foreground/60">
                {links.length}
              </span>
            )}
          </span>
          <CaretDownIcon
            className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={openAddForm}
          title="Add resource link"
          className="h-8 px-2"
        >
          <PlusIcon className="w-4 h-4" />
          <span className="sr-only">Add resource link</span>
        </Button>
      </div>

      {isOpen && (
        <div className="bg-card">
          {/* Link rows */}
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0"
            >
              {/* Favicon */}
              <img
                src={getFaviconUrl(link.url)}
                alt=""
                aria-hidden="true"
                className="w-4 h-4 shrink-0 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              {/* Label + domain */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{link.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {getDomain(link.url)}
                </p>
              </div>
              {/* Open externally */}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open link"
                className="shrink-0 p-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                <ArrowSquareOutIcon className="w-4 h-4" />
                <span className="sr-only">Open {link.label}</span>
              </a>
              {/* Delete */}
              <button
                type="button"
                onClick={() => void handleDelete(link.id)}
                title="Remove link"
                className="shrink-0 p-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-destructive"
              >
                <TrashIcon className="w-4 h-4" />
                <span className="sr-only">Remove {link.label}</span>
              </button>
            </div>
          ))}

          {/* Inline add form */}
          {showAddForm && (
            <div
              className={`px-4 py-3 space-y-3 ${links.length > 0 ? 'border-t border-border' : ''}`}
            >
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
      )}
    </div>
  );
}
