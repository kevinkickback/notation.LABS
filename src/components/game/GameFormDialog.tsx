import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EntityArtworkEditor } from '@/components/shared/EntityArtworkEditor';
import { FormSection } from '@/components/shared/FormSection';
import { RequiredBadge } from '@/components/shared/RequiredBadge';
import { Button } from '@/components/ui/button';
import { ColorPickerRow } from '@/components/ui/ColorPickerRow';
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
import { useCoverEditor } from '@/hooks/useCoverEditor';
import { useMediaRequest } from '@/hooks/useMediaRequest';
import { createGame, updateGame } from '@/lib/application/gameCommands';
import { DEFAULT_BUTTON_PALETTE } from '@/lib/defaults';
import { reportError } from '@/lib/errors';
import { readImageFile } from '@/lib/media/images';
import {
  getNotationProfileDefinition,
  NOTATION_PROFILES,
} from '@/lib/notationProfiles';
import type { Game, NotationProfile } from '@/lib/types';
import { CoverSearchDialog } from './CoverSearchDialog';

interface GameFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGame: Game | null;
}

export function GameFormDialog({
  open,
  onOpenChange,
  editingGame,
}: GameFormDialogProps) {
  const [name, setName] = useState('');
  const [buttonLayout, setButtonLayout] = useState('L, M, H, S');
  const [notes, setNotes] = useState('');
  const {
    image: logoImage,
    setImage: setLogoImage,
    zoom: coverZoom,
    setZoom: setCoverZoom,
    panX: coverPanX,
    setPanX: setCoverPanX,
    panY: coverPanY,
    setPanY: setCoverPanY,
    fit: coverFit,
    setFit: setCoverFit,
    initialize: initializeCover,
    reset: resetCover,
    resetTransform: resetCoverTransform,
    applyImage: applyCoverImage,
    serialize: serializeCover,
  } = useCoverEditor();
  const [dialogButtonColors, setDialogButtonColors] = useState<
    Record<string, string>
  >({});
  const [notationProfile, setNotationProfile] =
    useState<NotationProfile>('standard');
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { run: loadImage, cancel: cancelImage } = useMediaRequest(
    open,
    editingGame?.id ?? 'new',
  );

  const parsedButtons = useMemo(
    () =>
      buttonLayout
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
    [buttonLayout],
  );

  const formId = useId();
  const nameInputId = `${formId}-name`;
  const buttonsInputId = `${formId}-buttons`;
  const notesInputId = `${formId}-notes`;
  const notesHelpId = `${formId}-notes-help`;

  useEffect(() => {
    if (open && editingGame) {
      setName(editingGame.name);
      setButtonLayout(editingGame.buttonLayout.join(', '));
      setNotes(editingGame.notes || '');
      initializeCover({
        image: editingGame.logoImage,
        zoom: editingGame.coverZoom,
        panX: editingGame.coverPanX,
        panY: editingGame.coverPanY,
        fit: editingGame.coverFit,
      });
      setNotationProfile(editingGame.notationProfile);
      const existingColors = editingGame.buttonColors || {};
      const initialColors: Record<string, string> = {};
      for (let i = 0; i < editingGame.buttonLayout.length; i++) {
        const btn = editingGame.buttonLayout[i];
        initialColors[btn] =
          existingColors[btn] ||
          DEFAULT_BUTTON_PALETTE[i % DEFAULT_BUTTON_PALETTE.length];
      }
      setDialogButtonColors(initialColors);
    } else if (!open) {
      setName('');
      setButtonLayout('L, M, H, S');
      setNotes('');
      resetCover();
      setDialogButtonColors({});
      setNotationProfile('standard');
      setCoverSearchOpen(false);
    }
  }, [open, editingGame, initializeCover, resetCover]);

  useEffect(() => {
    setDialogButtonColors((prev) => {
      const updated: Record<string, string> = {};
      for (let i = 0; i < parsedButtons.length; i++) {
        const btn = parsedButtons[i];
        updated[btn] =
          prev[btn] ||
          DEFAULT_BUTTON_PALETTE[i % DEFAULT_BUTTON_PALETTE.length];
      }
      return updated;
    });
  }, [parsedButtons]);

  const closeDialog = () => {
    onOpenChange(false);
  };

  const handleProfileChange = (nextProfile: NotationProfile) => {
    const currentDefaults =
      getNotationProfileDefinition(notationProfile).defaultButtons.join(', ');
    if (buttonLayout === currentDefaults) {
      setButtonLayout(
        getNotationProfileDefinition(nextProfile).defaultButtons.join(', '),
      );
    }
    setNotationProfile(nextProfile);
  };

  const buildGamePayload = () => {
    const cover = serializeCover();
    return {
      name: name.trim(),
      buttonLayout: buttonLayout
        .split(',')
        .map((button) => button.trim())
        .filter(Boolean),
      buttonColors: { ...dialogButtonColors },
      notes: notes.trim(),
      notationProfile,
      logoImage: cover.image,
      coverZoom: cover.zoom,
      coverPanX: cover.panX,
      coverPanY: cover.panY,
      coverFit: cover.fit,
    };
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Game name is required');
      return;
    }
    try {
      const payload = buildGamePayload();
      if (editingGame) {
        await updateGame(editingGame.id, payload);
      } else {
        await createGame(payload);
      }
      toast.success(editingGame ? 'Game updated' : 'Game added');
      closeDialog();
    } catch (error) {
      reportError('GameFormDialog.handleSubmit', error);
      toast.error(editingGame ? 'Failed to update game' : 'Failed to add game');
    }
  };

  const handleImageSelect = () => imageInputRef.current?.click();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void loadImage(file.name, (signal) => readImageFile(file, signal), {
      onSuccess: applyCoverImage,
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
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeDialog();
        }}
      >
        <DialogContent
          className="dialog-form entity-form-dialog game-form-dialog flex flex-col overflow-hidden"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(nameInputId)?.focus();
          }}
        >
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <DialogHeader className="shrink-0 border-b border-border pb-4 pr-6">
              <DialogTitle>
                {editingGame ? 'Edit Game' : 'Add New Game'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Configure the game profile, notation, and optional notes.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="entity-editor">
              <div className="entity-identity">
                <div className="flex items-center gap-2">
                  <Label htmlFor={nameInputId}>Game Name</Label>
                  <RequiredBadge />
                </div>
                <Input
                  id={nameInputId}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Street Fighter 6"
                />
              </div>
              <EntityArtworkEditor
                label="Cover Artwork"
                image={logoImage}
                orientation="portrait"
                fit={coverFit}
                zoom={coverZoom}
                focalX={coverPanX}
                focalY={coverPanY}
                onUpload={handleImageSelect}
                onSearch={() => {
                  cancelImage();
                  setCoverSearchOpen(true);
                }}
                onRemove={() => {
                  cancelImage();
                  setLogoImage('');
                }}
                onFitChange={setCoverFit}
                onZoomChange={setCoverZoom}
                onFocalXChange={setCoverPanX}
                onFocalYChange={setCoverPanY}
                onReset={resetCoverTransform}
              />

              <FormSection className="entity-notation">
                <fieldset>
                  <legend className="text-sm leading-none font-medium">
                    Notation Style
                  </legend>
                  <div className="entity-notation-options mt-1.5 grid gap-2">
                    {NOTATION_PROFILES.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        aria-label={profile.label}
                        aria-pressed={notationProfile === profile.id}
                        onClick={() => handleProfileChange(profile.id)}
                        className={`rounded-md border px-3 py-2 text-center transition-colors ${
                          notationProfile === profile.id
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        <span className="block text-sm font-medium">
                          {profile.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {getNotationProfileDefinition(notationProfile).description}
                  </p>
                </fieldset>

                <div>
                  <Label htmlFor={buttonsInputId}>
                    Button Layout (comma-separated)
                  </Label>
                  <Input
                    id={buttonsInputId}
                    value={buttonLayout}
                    onChange={(e) => setButtonLayout(e.target.value)}
                    placeholder={getNotationProfileDefinition(
                      notationProfile,
                    ).defaultButtons.join(', ')}
                  />
                </div>

                {parsedButtons.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <Label className="mb-2 block text-sm font-medium">
                      Button Colors
                    </Label>
                    <div className="entity-button-colors grid grid-cols-2 gap-x-4 gap-y-2">
                      {parsedButtons.map((btn, i) => (
                        <ColorPickerRow
                          key={btn}
                          label={btn}
                          value={
                            dialogButtonColors[btn] ||
                            DEFAULT_BUTTON_PALETTE[
                              i % DEFAULT_BUTTON_PALETTE.length
                            ]
                          }
                          onChange={(hex) =>
                            setDialogButtonColors((prev) => ({
                              ...prev,
                              [btn]: hex,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </FormSection>

              <FormSection className="entity-notes">
                <div>
                  <Label htmlFor={notesInputId}>Game notes (optional)</Label>
                  <Textarea
                    id={notesInputId}
                    aria-describedby={notesHelpId}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional notes about the game..."
                  />
                  <p
                    id={notesHelpId}
                    className="mt-1.5 text-xs text-muted-foreground"
                  >
                    Markdown is supported.
                  </p>
                </div>
              </FormSection>
            </DialogBody>
            <DialogFooter className="shrink-0 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingGame ? 'Save Changes' : 'Add Game'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CoverSearchDialog
        key={editingGame?.id ?? 'new'}
        open={open && coverSearchOpen}
        onOpenChange={setCoverSearchOpen}
        defaultQuery={name}
        onCoverSelect={(base64) => {
          applyCoverImage(base64);
          setCoverSearchOpen(false);
        }}
      />
    </>
  );
}
