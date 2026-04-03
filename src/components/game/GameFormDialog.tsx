import type { Game } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ImageSquare, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useState, useMemo, useEffect, useId, useRef } from 'react';
import { CoverSearchDialog } from './CoverSearchDialog';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { toast } from 'sonner';
import { ColorPickerRow } from '@/components/ui/ColorPickerRow';
import { DEFAULT_BUTTON_PALETTE } from '@/lib/defaults';
import { isAllowedImageUpload } from '@/lib/utils';

interface GameFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingGame: Game | null;
}

export function GameFormDialog({ open, onOpenChange, editingGame }: GameFormDialogProps) {
    const [name, setName] = useState('');
    const [buttonLayout, setButtonLayout] = useState('L, M, H, S');
    const [notes, setNotes] = useState('');
    const [logoImage, setLogoImage] = useState('');
    const [coverZoom, setCoverZoom] = useState(100);
    const [coverPanX, setCoverPanX] = useState(50);
    const [coverPanY, setCoverPanY] = useState(50);
    const [dialogButtonColors, setDialogButtonColors] = useState<Record<string, string>>({});
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

    useEffect(() => {
        if (open && editingGame) {
            setName(editingGame.name);
            setButtonLayout(editingGame.buttonLayout.join(', '));
            setNotes(editingGame.notes || '');
            setLogoImage(editingGame.logoImage || '');
            setCoverZoom(editingGame.coverZoom || 100);
            setCoverPanX(editingGame.coverPanX ?? 50);
            setCoverPanY(editingGame.coverPanY ?? 50);
            const existingColors = editingGame.buttonColors || {};
            const initialColors: Record<string, string> = {};
            editingGame.buttonLayout.forEach((btn, i) => {
                initialColors[btn] = existingColors[btn] || DEFAULT_BUTTON_PALETTE[i % DEFAULT_BUTTON_PALETTE.length];
            });
            setDialogButtonColors(initialColors);
        } else if (!open) {
            setName('');
            setButtonLayout('L, M, H, S');
            setNotes('');
            setLogoImage('');
            setCoverZoom(100);
            setCoverPanX(50);
            setCoverPanY(50);
            setDialogButtonColors({});
            setCoverSearchOpen(false);
        }
    }, [open, editingGame]);

    useEffect(() => {
        setDialogButtonColors((prev) => {
            const updated: Record<string, string> = {};
            parsedButtons.forEach((btn, i) => {
                updated[btn] =
                    prev[btn] ||
                    DEFAULT_BUTTON_PALETTE[i % DEFAULT_BUTTON_PALETTE.length];
            });
            return updated;
        });
    }, [parsedButtons]);

    const closeDialog = () => {
        onOpenChange(false);
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
                logoImage: logoImage || undefined,
                coverZoom: coverZoom !== 100 ? coverZoom : undefined,
                coverPanX: coverPanX !== 50 ? coverPanX : undefined,
                coverPanY: coverPanY !== 50 ? coverPanY : undefined,
            });
            toast.success('Game added');
            closeDialog();
        } catch {
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
                logoImage: logoImage || undefined,
                coverZoom: coverZoom !== 100 ? coverZoom : undefined,
                coverPanX: coverPanX !== 50 ? coverPanX : undefined,
                coverPanY: coverPanY !== 50 ? coverPanY : undefined,
            });
            toast.success('Game updated');
            closeDialog();
        } catch {
            toast.error('Failed to update game');
        }
    };

    const handleImageSelect = () => imageInputRef.current?.click();

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
        reader.onload = () => setLogoImage(reader.result as string);
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingGame ? 'Edit Game' : 'Add New Game'}</DialogTitle>
                        <DialogDescription>
                            Set the game name, artwork, button layout, and optional notes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Cover Image (optional)</Label>
                            <div className="flex items-start gap-3 mt-1">
                                <div className="w-36 aspect-[3/4] shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                                    {logoImage ? (
                                        <img
                                            src={logoImage}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            style={{
                                                transform: `scale(${coverZoom / 100})`,
                                                transformOrigin: `${coverPanX}% ${coverPanY}%`,
                                            }}
                                        />
                                    ) : (
                                        <ImageSquare className="w-8 h-8 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-sm px-4"
                                        onClick={handleImageSelect}
                                    >
                                        <ImageSquare className="w-4 h-4 mr-2 shrink-0" />
                                        Upload Image
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-sm px-4"
                                        onClick={() => setCoverSearchOpen(true)}
                                    >
                                        <MagnifyingGlass className="w-4 h-4 mr-2 shrink-0" />
                                        Search Covers
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={!logoImage}
                                        className="h-8 text-sm px-4 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600 disabled:opacity-40 disabled:pointer-events-none"
                                        onClick={() => setLogoImage('')}
                                    >
                                        <X className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                        Remove
                                    </Button>
                                    <div
                                        className={`flex items-center gap-2 mt-1 ${!logoImage ? 'opacity-40 pointer-events-none' : ''}`}
                                    >
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            Zoom
                                        </span>
                                        <Slider
                                            min={100}
                                            max={200}
                                            step={5}
                                            value={[coverZoom]}
                                            onValueChange={([v]) => setCoverZoom(v)}
                                            className="flex-1"
                                            disabled={!logoImage}
                                        />
                                        <span className="text-xs text-muted-foreground w-8 text-right">
                                            {coverZoom}%
                                        </span>
                                    </div>
                                    <div
                                        className={`flex items-center gap-2 ${!logoImage ? 'opacity-40 pointer-events-none' : ''}`}
                                    >
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            Pan X
                                        </span>
                                        <Slider
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={[coverPanX]}
                                            onValueChange={([v]) => setCoverPanX(v)}
                                            className="flex-1"
                                            disabled={!logoImage}
                                        />
                                    </div>
                                    <div
                                        className={`flex items-center gap-2 ${!logoImage ? 'opacity-40 pointer-events-none' : ''}`}
                                    >
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            Pan Y
                                        </span>
                                        <Slider
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={[coverPanY]}
                                            onValueChange={([v]) => setCoverPanY(v)}
                                            className="flex-1"
                                            disabled={!logoImage}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor={nameInputId}>Game Name</Label>
                            <Input
                                id={nameInputId}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Street Fighter 6"
                            />
                        </div>

                        <div>
                            <Label htmlFor={buttonsInputId}>
                                Button Layout (comma-separated)
                            </Label>
                            <Input
                                id={buttonsInputId}
                                value={buttonLayout}
                                onChange={(e) => setButtonLayout(e.target.value)}
                                placeholder="L, M, H, S"
                            />
                        </div>

                        {parsedButtons.length > 0 && (
                            <div>
                                <Label className="text-sm font-medium mb-2 block">
                                    Button Colors
                                </Label>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    {parsedButtons.map((btn, i) => (
                                        <ColorPickerRow
                                            key={btn}
                                            label={btn}
                                            value={
                                                dialogButtonColors[btn] ||
                                                DEFAULT_BUTTON_PALETTE[i % DEFAULT_BUTTON_PALETTE.length]
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

                        <div>
                            <Label htmlFor={notesInputId}>Notes (optional)</Label>
                            <Textarea
                                id={notesInputId}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={closeDialog}>
                                Cancel
                            </Button>
                            <Button onClick={editingGame ? handleEdit : handleAdd}>
                                {editingGame ? 'Save Changes' : 'Add Game'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <CoverSearchDialog
                open={coverSearchOpen}
                onOpenChange={setCoverSearchOpen}
                defaultQuery={name}
                onCoverSelect={(base64) => {
                    setLogoImage(base64);
                    setCoverSearchOpen(false);
                }}
            />
        </>
    );
}
