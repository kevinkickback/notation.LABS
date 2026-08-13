import {
  ImageSquareIcon,
  MagnifyingGlassIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CoverImage } from '@/components/shared/CoverImage';
import { CoverImageControls } from '@/components/shared/CoverImageControls';
import { RequiredBadge } from '@/components/shared/RequiredBadge';
import { Button } from '@/components/ui/button';
import { ColorPickerRow } from '@/components/ui/ColorPickerRow';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { DEFAULT_BUTTON_PALETTE } from '@/lib/defaults';
import { reportError } from '@/lib/errors';
import {
  getNotationProfileDefinition,
  NOTATION_PROFILES,
  resolveNotationProfile,
} from '@/lib/notationProfiles';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { CoverImageFit, Game, NotationProfile } from '@/lib/types';
import { isAllowedImageUpload } from '@/lib/utils';
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
  const [logoImage, setLogoImage] = useState('');
  const [coverZoom, setCoverZoom] = useState(100);
  const [coverPanX, setCoverPanX] = useState(50);
  const [coverPanY, setCoverPanY] = useState(50);
  const [coverFit, setCoverFit] = useState<CoverImageFit>('fill');
  const [dialogButtonColors, setDialogButtonColors] = useState<
    Record<string, string>
  >({});
  const [notationProfile, setNotationProfile] =
    useState<NotationProfile>('standard');
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
      setLogoImage(editingGame.logoImage || '');
      setCoverZoom(editingGame.coverZoom || 100);
      setCoverPanX(editingGame.coverPanX ?? 50);
      setCoverPanY(editingGame.coverPanY ?? 50);
      setCoverFit(editingGame.coverFit ?? 'fill');
      setNotationProfile(resolveNotationProfile(editingGame));
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
      setLogoImage('');
      setCoverZoom(100);
      setCoverPanX(50);
      setCoverPanY(50);
      setCoverFit('fill');
      setDialogButtonColors({});
      setNotationProfile('standard');
      setCoverSearchOpen(false);
    }
  }, [open, editingGame]);

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

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Game name is required');
      return;
    }
    try {
      const buttons = buttonLayout
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);
      await indexedDbStorage.games.add({
        name: name.trim(),
        buttonLayout: buttons,
        buttonColors: { ...dialogButtonColors },
        notes: notes.trim(),
        notationProfile,
        logoImage: logoImage || undefined,
        coverZoom: coverZoom !== 100 ? coverZoom : undefined,
        coverPanX: coverPanX !== 50 ? coverPanX : undefined,
        coverPanY: coverPanY !== 50 ? coverPanY : undefined,
        coverFit: coverFit !== 'fill' ? coverFit : undefined,
      });
      toast.success('Game added');
      closeDialog();
    } catch (error) {
      reportError('GameFormDialog.handleAdd', error);
      toast.error('Failed to add game');
    }
  };

  const handleEdit = async () => {
    if (!editingGame) return;
    if (!name.trim()) {
      toast.error('Game name is required');
      return;
    }
    try {
      const buttons = buttonLayout
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);
      await indexedDbStorage.games.update(editingGame.id, {
        name: name.trim(),
        buttonLayout: buttons,
        buttonColors: { ...dialogButtonColors },
        notes: notes.trim(),
        notationProfile,
        logoImage: logoImage || undefined,
        coverZoom: coverZoom !== 100 ? coverZoom : undefined,
        coverPanX: coverPanX !== 50 ? coverPanX : undefined,
        coverPanY: coverPanY !== 50 ? coverPanY : undefined,
        coverFit: coverFit !== 'fill' ? coverFit : undefined,
      });
      toast.success('Game updated');
      closeDialog();
    } catch (error) {
      reportError('GameFormDialog.handleEdit', error);
      toast.error('Failed to update game');
    }
  };

  const handleImageSelect = () => imageInputRef.current?.click();

  const applyCoverImage = (image: string) => {
    setLogoImage(image);
    setCoverZoom(100);
    setCoverPanX(50);
    setCoverPanY(50);
    setCoverFit('fill');
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
    reader.onload = () => applyCoverImage(reader.result as string);
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
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeDialog();
        }}
      >
        <DialogContent className="flex flex-col overflow-hidden sm:max-w-xl">
          <form
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              void (editingGame ? handleEdit() : handleAdd());
            }}
          >
            <DialogHeader className="shrink-0 border-b border-border pb-4 pr-6">
              <DialogTitle>
                {editingGame ? 'Edit Game' : 'Add New Game'}
              </DialogTitle>
              <DialogDescription>
                Configure the game profile, notation, and optional notes.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="-mr-2 space-y-4 pr-2">
              <Card className="gap-3 py-4 shadow-none">
                <CardHeader className="gap-1 px-4">
                  <CardTitle className="text-sm">Game Profile</CardTitle>
                  <CardDescription className="text-xs">
                    Set the name and artwork shown throughout the app.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4">
                  <div>
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
                  <div>
                    <Label>Cover Artwork (optional)</Label>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Upload or find artwork, then drag the preview to position
                      it.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex aspect-[3/4] w-[clamp(6rem,20dvh,8rem)] shrink-0 self-center items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted sm:self-auto">
                        {logoImage ? (
                          <>
                            <CoverImage
                              src={logoImage}
                              frameAspect={3 / 4}
                              fit={coverFit}
                              zoom={coverZoom}
                              focalX={coverPanX}
                              focalY={coverPanY}
                              interactive
                              className="absolute inset-0"
                              onFocalPointChange={(x, y) => {
                                setCoverPanX(Math.round(x));
                                setCoverPanY(Math.round(y));
                              }}
                            />
                            <div
                              className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
                              style={{
                                background:
                                  'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.2) 80%, transparent 100%)',
                              }}
                            />
                            <button
                              type="button"
                              aria-label="Remove image"
                              onClick={() => setLogoImage('')}
                              className="absolute top-1 right-1 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-600/80 text-white transition-colors hover:bg-red-600"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <ImageSquareIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        {logoImage ? (
                          <CoverImageControls
                            fit={coverFit}
                            zoom={coverZoom}
                            focalX={coverPanX}
                            focalY={coverPanY}
                            onFitChange={setCoverFit}
                            onZoomChange={setCoverZoom}
                            onFocalXChange={setCoverPanX}
                            onFocalYChange={setCoverPanY}
                            onReset={() => {
                              setCoverZoom(100);
                              setCoverPanX(50);
                              setCoverPanY(50);
                              setCoverFit('fill');
                            }}
                          />
                        ) : (
                          <div className="flex h-full flex-col justify-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleImageSelect}
                            >
                              <ImageSquareIcon className="mr-2 h-4 w-4 shrink-0" />
                              Upload Image
                            </Button>
                            <div className="flex items-center gap-2">
                              <div className="h-px flex-1 bg-border" />
                              <span className="text-xs text-muted-foreground">
                                or
                              </span>
                              <div className="h-px flex-1 bg-border" />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCoverSearchOpen(true)}
                            >
                              <MagnifyingGlassIcon className="mr-2 h-4 w-4 shrink-0" />
                              Search Online
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-3 py-4 shadow-none">
                <CardHeader className="gap-1 px-4">
                  <CardTitle className="text-sm">Notation & Buttons</CardTitle>
                  <CardDescription className="text-xs">
                    Choose how inputs are interpreted and displayed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                  <fieldset>
                    <legend className="text-sm leading-none font-medium">
                      Notation Style
                    </legend>
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                      {NOTATION_PROFILES.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          aria-label={profile.label}
                          aria-pressed={notationProfile === profile.id}
                          onClick={() => handleProfileChange(profile.id)}
                          className={`rounded-md border px-3 py-2 text-left transition-colors ${
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
                      {
                        getNotationProfileDefinition(notationProfile)
                          .description
                      }
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
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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
                </CardContent>
              </Card>

              <Card className="gap-3 py-4 shadow-none">
                <CardHeader className="gap-1 px-4">
                  <CardTitle className="text-sm">Notes</CardTitle>
                  <CardDescription id={notesHelpId} className="text-xs">
                    Add optional context or reminders about this game. Multiple
                    lines and Markdown are supported.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4">
                  <Label htmlFor={notesInputId} className="sr-only">
                    Game notes
                  </Label>
                  <Textarea
                    id={notesInputId}
                    aria-describedby={notesHelpId}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional notes about the game..."
                  />
                </CardContent>
              </Card>
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
        open={coverSearchOpen}
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
