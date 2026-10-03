import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EntityArtworkEditor } from '@/components/shared/EntityArtworkEditor';
import { FormSection } from '@/components/shared/FormSection';
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
import { useCoverEditor } from '@/hooks/useCoverEditor';
import { useMediaRequest } from '@/hooks/useMediaRequest';
import { useSubmission } from '@/hooks/useSubmission';
import {
  createCharacter,
  updateCharacter,
} from '@/lib/application/characterCommands';
import { reportError } from '@/lib/errors';
import { readImageFile } from '@/lib/media/images';
import type { Character, Game } from '@/lib/types';
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
  const { pending, submit } = useSubmission(
    open,
    `${game.id}:${editingCharacter?.id ?? 'new'}`,
  );
  const settings = useSettings();
  const orientation = settings.characterCardOrientation ?? 'landscape';
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const {
    image: portraitImage,
    setImage: setPortraitImage,
    zoom: portraitZoom,
    setZoom: setPortraitZoom,
    panX: portraitPanX,
    setPanX: setPortraitPanX,
    panY: portraitPanY,
    setPanY: setPortraitPanY,
    fit: portraitFit,
    setFit: setPortraitFit,
    initialize: initializePortrait,
    reset: resetPortrait,
    resetTransform: resetPortraitTransform,
    applyImage: applyPortraitImage,
    serialize: serializePortrait,
  } = useCoverEditor();
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { run: loadImage, cancel: cancelImage } = useMediaRequest(
    open,
    `${game.id}:${editingCharacter?.id ?? 'new'}`,
  );
  const charNameId = useId();
  const charNotesId = useId();
  const charNotesHelpId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: A different parent starts a new unsaved character draft.
  useEffect(() => {
    if (open && editingCharacter) {
      setName(editingCharacter.name);
      setNotes(editingCharacter.notes || '');
      initializePortrait({
        image: editingCharacter.portraitImage,
        zoom: editingCharacter.portraitZoom,
        panX: editingCharacter.portraitPanX,
        panY: editingCharacter.portraitPanY,
        fit: editingCharacter.portraitFit,
      });
    } else {
      setName('');
      setNotes('');
      resetPortrait();
      setImageSearchOpen(false);
    }
  }, [open, game.id, editingCharacter, initializePortrait, resetPortrait]);

  const buildCharacterPayload = () => {
    const portrait = serializePortrait();
    return {
      name: name.trim(),
      notes: notes.trim(),
      portraitImage: portrait.image,
      portraitZoom: portrait.zoom,
      portraitPanX: portrait.panX,
      portraitPanY: portrait.panY,
      portraitFit: portrait.fit,
    };
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Character name is required');
      return;
    }
    await submit(
      async () => {
        const payload = buildCharacterPayload();
        if (editingCharacter) {
          await updateCharacter(editingCharacter.id, payload);
        } else {
          await createCharacter({ gameId: game.id, ...payload });
        }
      },
      {
        onSuccess: () => {
          toast.success(
            editingCharacter ? 'Character updated' : 'Character added',
          );
          onOpenChange(false);
        },
        onError: (error) => {
          reportError('CharacterFormDialog.handleSubmit', error);
          toast.error(
            editingCharacter
              ? 'Failed to update character'
              : 'Failed to add character',
          );
        },
      },
    );
  };

  const handleImageSelect = () => imageInputRef.current?.click();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void loadImage(file.name, (signal) => readImageFile(file, signal), {
      onSuccess: applyPortraitImage,
      onError: (error) =>
        toast.error(
          error instanceof Error ? error.message : 'Failed to read image file',
        ),
    });
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
        <DialogContent
          className="dialog-form entity-form-dialog character-form-dialog flex flex-col overflow-hidden"
          onOpenAutoFocus={(event) => {
            if (pending) return;
            event.preventDefault();
            document.getElementById(charNameId)?.focus();
          }}
        >
          <form
            aria-busy={pending}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <DialogHeader className="shrink-0 border-b border-border pb-4 pr-6">
              <DialogTitle>
                {editingCharacter
                  ? 'Edit Character'
                  : `Add Character to ${game.name}`}
              </DialogTitle>
              {editingCharacter && (
                <p className="entity-game-context">{game.name}</p>
              )}
              <DialogDescription className="sr-only">
                {editingCharacter
                  ? 'Update this character’s name, portrait, and notes.'
                  : 'Add a character with an optional portrait and notes.'}
              </DialogDescription>
            </DialogHeader>
            <fieldset disabled={pending} inert={pending} className="contents">
              <DialogBody className="entity-editor">
                <div className="entity-identity">
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
                <EntityArtworkEditor
                  label="Character Image"
                  image={portraitImage}
                  orientation={orientation}
                  fit={portraitFit}
                  zoom={portraitZoom}
                  focalX={portraitPanX}
                  focalY={portraitPanY}
                  onUpload={handleImageSelect}
                  onSearch={() => {
                    cancelImage();
                    setImageSearchOpen(true);
                  }}
                  onRemove={() => {
                    cancelImage();
                    setPortraitImage('');
                  }}
                  onFitChange={setPortraitFit}
                  onZoomChange={setPortraitZoom}
                  onFocalXChange={setPortraitPanX}
                  onFocalYChange={setPortraitPanY}
                  onReset={resetPortraitTransform}
                />
                <FormSection className="entity-notes">
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
                </FormSection>
              </DialogBody>
            </fieldset>
            <DialogFooter className="shrink-0 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {editingCharacter ? 'Save Changes' : 'Add Character'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CharacterSearchDialog
        key={`${game.id}:${editingCharacter?.id ?? 'new'}`}
        open={open && imageSearchOpen}
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
