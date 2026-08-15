import {
  ImageSquareIcon,
  MagnifyingGlassIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CoverImage } from '@/components/shared/CoverImage';
import { CoverImageControls } from '@/components/shared/CoverImageControls';
import { RequiredBadge } from '@/components/shared/RequiredBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/context/SettingsContext';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Character, CoverImageFit, Game } from '@/lib/types';
import { isAllowedImageUpload } from '@/lib/utils';
import { CharacterSearchDialog } from './CharacterSearchDialog';

interface CharacterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCharacter: Character | null;
  game: Game;
}

export function CharacterFormDialog({
  open,
  onOpenChange,
  editingCharacter,
  game,
}: CharacterFormDialogProps) {
  const settings = useSettings();
  const orientation = settings.characterCardOrientation ?? 'landscape';
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [portraitImage, setPortraitImage] = useState('');
  const [portraitZoom, setPortraitZoom] = useState(100);
  const [portraitPanX, setPortraitPanX] = useState(50);
  const [portraitPanY, setPortraitPanY] = useState(50);
  const [portraitFit, setPortraitFit] = useState<CoverImageFit>('fill');
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const charNameId = useId();
  const charNotesId = useId();
  const charNotesHelpId = useId();

  useEffect(() => {
    if (open && editingCharacter) {
      setName(editingCharacter.name);
      setNotes(editingCharacter.notes || '');
      setPortraitImage(editingCharacter.portraitImage || '');
      setPortraitZoom(editingCharacter.portraitZoom || 100);
      setPortraitPanX(editingCharacter.portraitPanX ?? 50);
      setPortraitPanY(editingCharacter.portraitPanY ?? 50);
      setPortraitFit(editingCharacter.portraitFit ?? 'fill');
    } else if (!open) {
      setName('');
      setNotes('');
      setPortraitImage('');
      setPortraitZoom(100);
      setPortraitPanX(50);
      setPortraitPanY(50);
      setPortraitFit('fill');
      setImageSearchOpen(false);
    }
  }, [open, editingCharacter]);

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Character name is required');
      return;
    }
    try {
      await indexedDbStorage.characters.add({
        gameId: game.id,
        name: name.trim(),
        notes: notes.trim(),
        portraitImage: portraitImage || undefined,
        portraitZoom: portraitZoom !== 100 ? portraitZoom : undefined,
        portraitPanX: portraitPanX !== 50 ? portraitPanX : undefined,
        portraitPanY: portraitPanY !== 50 ? portraitPanY : undefined,
        portraitFit: portraitFit !== 'fill' ? portraitFit : undefined,
      });
      toast.success('Character added');
      onOpenChange(false);
    } catch {
      toast.error('Failed to add character');
    }
  };

  const handleEdit = async () => {
    if (!editingCharacter) return;
    if (!name.trim()) {
      toast.error('Character name is required');
      return;
    }
    try {
      await indexedDbStorage.characters.update(editingCharacter.id, {
        name: name.trim(),
        notes: notes.trim(),
        portraitImage: portraitImage || undefined,
        portraitZoom: portraitZoom !== 100 ? portraitZoom : undefined,
        portraitPanX: portraitPanX !== 50 ? portraitPanX : undefined,
        portraitPanY: portraitPanY !== 50 ? portraitPanY : undefined,
        portraitFit: portraitFit !== 'fill' ? portraitFit : undefined,
      });
      toast.success('Character updated');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update character');
    }
  };

  const handleImageSelect = () => imageInputRef.current?.click();

  const applyPortraitImage = (image: string) => {
    setPortraitImage(image);
    setPortraitZoom(100);
    setPortraitPanX(50);
    setPortraitPanY(50);
    setPortraitFit('fill');
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      e.target.value = '';
      return;
    }
    if (!(await isAllowedImageUpload(file))) {
      toast.error('Unsupported or invalid image file');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => applyPortraitImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex flex-col overflow-hidden">
          <form
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              void (editingCharacter ? handleEdit() : handleAdd());
            }}
          >
            <DialogHeader className="shrink-0 border-b border-border pb-4 pr-6">
              <DialogTitle>
                {editingCharacter
                  ? 'Edit Character'
                  : `Add Character to ${game.name}`}
              </DialogTitle>
              <DialogDescription>
                {editingCharacter
                  ? 'Update this character’s name, portrait, and notes.'
                  : 'Add a character with an optional portrait and notes.'}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="-mr-2 space-y-3 pr-2">
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={charNameId}>Character Name</Label>
                  <RequiredBadge />
                </div>
                <Input
                  id={charNameId}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ryu"
                />
              </div>

              <div>
                <Label>Character Image (optional)</Label>
                <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                  <div
                    className={`relative flex shrink-0 self-center items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted sm:self-auto ${
                      orientation === 'portrait'
                        ? 'w-28 aspect-[3/4]'
                        : 'w-44 aspect-[4/3]'
                    }`}
                  >
                    {portraitImage ? (
                      <>
                        <CoverImage
                          src={portraitImage}
                          frameAspect={
                            orientation === 'portrait' ? 3 / 4 : 4 / 3
                          }
                          fit={portraitFit}
                          zoom={portraitZoom}
                          focalX={portraitPanX}
                          focalY={portraitPanY}
                          interactive
                          className="absolute inset-0"
                          onFocalPointChange={(x, y) => {
                            setPortraitPanX(Math.round(x));
                            setPortraitPanY(Math.round(y));
                          }}
                        />
                        <div
                          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
                          style={{
                            background:
                              'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.2) 80%, transparent 100%)',
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={() => setPortraitImage('')}
                          className="absolute top-1 right-1 z-10 rounded-full bg-red-600/80 hover:bg-red-600 text-white w-5 h-5 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <ImageSquareIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    {portraitImage ? (
                      <CoverImageControls
                        fit={portraitFit}
                        zoom={portraitZoom}
                        focalX={portraitPanX}
                        focalY={portraitPanY}
                        onFitChange={setPortraitFit}
                        onZoomChange={setPortraitZoom}
                        onFocalXChange={setPortraitPanX}
                        onFocalYChange={setPortraitPanY}
                        onReset={() => {
                          setPortraitZoom(100);
                          setPortraitPanX(50);
                          setPortraitPanY(50);
                          setPortraitFit('fill');
                        }}
                      />
                    ) : (
                      <div className="flex flex-col justify-center gap-1.5 h-full">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleImageSelect}
                        >
                          <ImageSquareIcon className="w-4 h-4 mr-2 shrink-0" />
                          Upload Image
                        </Button>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground">
                            or
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setImageSearchOpen(true)}
                        >
                          <MagnifyingGlassIcon className="w-4 h-4 mr-2 shrink-0" />
                          Search Online
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor={charNotesId}>Notes (optional)</Label>
                <Textarea
                  id={charNotesId}
                  aria-describedby={charNotesHelpId}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
                <p
                  id={charNotesHelpId}
                  className="mt-1.5 text-xs text-muted-foreground"
                >
                  Multiple lines and Markdown are supported.
                </p>
              </div>
            </DialogBody>
            <DialogFooter className="shrink-0 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingCharacter ? 'Save Changes' : 'Add Character'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CharacterSearchDialog
        open={imageSearchOpen}
        onOpenChange={setImageSearchOpen}
        searchQuery={`${game.name} ${name}`.trim()}
        onImageSelect={(base64) => {
          applyPortraitImage(base64);
          setImageSearchOpen(false);
        }}
      />
    </>
  );
}
