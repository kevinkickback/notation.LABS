import type { Character, Game } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ImageSquare, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useState, useEffect, useId, useRef } from 'react';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { toast } from 'sonner';
import { CharacterSearchDialog } from './CharacterSearchDialog';
import { isAllowedImageUpload } from '@/lib/utils';

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
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [portraitImage, setPortraitImage] = useState('');
    const [portraitZoom, setPortraitZoom] = useState(100);
    const [portraitPanX, setPortraitPanX] = useState(50);
    const [portraitPanY, setPortraitPanY] = useState(50);
    const [imageSearchOpen, setImageSearchOpen] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const charNameId = useId();
    const charNotesId = useId();

    useEffect(() => {
        if (open && editingCharacter) {
            setName(editingCharacter.name);
            setNotes(editingCharacter.notes || '');
            setPortraitImage(editingCharacter.portraitImage || '');
            setPortraitZoom(editingCharacter.portraitZoom || 100);
            setPortraitPanX(editingCharacter.portraitPanX ?? 50);
            setPortraitPanY(editingCharacter.portraitPanY ?? 50);
        } else if (!open) {
            setName('');
            setNotes('');
            setPortraitImage('');
            setPortraitZoom(100);
            setPortraitPanX(50);
            setPortraitPanY(50);
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
            });
            toast.success('Character updated');
            onOpenChange(false);
        } catch {
            toast.error('Failed to update character');
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
        reader.onload = () => setPortraitImage(reader.result as string);
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCharacter
                                ? 'Edit Character'
                                : `Add Character to ${game.name}`}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Character Image (optional)</Label>
                            <div className="flex items-start gap-3 mt-1">
                                <div className="w-44 h-28 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border relative">
                                    {portraitImage ? (
                                        <div
                                            className="absolute inset-0"
                                            style={{
                                                backgroundImage: `url(${portraitImage})`,
                                                backgroundSize: `${portraitZoom}%`,
                                                backgroundPosition: `${portraitPanX}% ${portraitPanY}%`,
                                                backgroundRepeat: 'no-repeat',
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
                                        onClick={handleImageSelect}
                                    >
                                        <ImageSquare className="w-4 h-4 mr-2 shrink-0" />
                                        Upload Image
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setImageSearchOpen(true)}
                                    >
                                        <MagnifyingGlass className="w-4 h-4 mr-2 shrink-0" />
                                        Search Images
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={!portraitImage}
                                        onClick={() => setPortraitImage('')}
                                        className="text-xs h-6 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600 disabled:opacity-40 disabled:pointer-events-none"
                                    >
                                        <X className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                        Remove
                                    </Button>
                                    <div
                                        className={`flex items-center gap-2 mt-1 ${!portraitImage ? 'opacity-40 pointer-events-none' : ''}`}
                                    >
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            Zoom
                                        </span>
                                        <Slider
                                            min={100}
                                            max={200}
                                            step={5}
                                            value={[portraitZoom]}
                                            onValueChange={([v]) => setPortraitZoom(v)}
                                            className="flex-1"
                                            disabled={!portraitImage}
                                        />
                                        <span className="text-xs text-muted-foreground w-8 text-right">
                                            {portraitZoom}%
                                        </span>
                                    </div>
                                    <div
                                        className={`flex items-center gap-2 ${!portraitImage ? 'opacity-40 pointer-events-none' : ''}`}
                                    >
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            Pan X
                                        </span>
                                        <Slider
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={[portraitPanX]}
                                            onValueChange={([v]) => setPortraitPanX(v)}
                                            className="flex-1"
                                            disabled={!portraitImage}
                                        />
                                    </div>
                                    <div
                                        className={`flex items-center gap-2 ${!portraitImage ? 'opacity-40 pointer-events-none' : ''}`}
                                    >
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            Pan Y
                                        </span>
                                        <Slider
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={[portraitPanY]}
                                            onValueChange={([v]) => setPortraitPanY(v)}
                                            className="flex-1"
                                            disabled={!portraitImage}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor={charNameId}>Character Name</Label>
                            <Input
                                id={charNameId}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ryu"
                            />
                        </div>

                        <div>
                            <Label htmlFor={charNotesId}>Notes (optional)</Label>
                            <Textarea
                                id={charNotesId}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={editingCharacter ? handleEdit : handleAdd}>
                                {editingCharacter ? 'Save Changes' : 'Add Character'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <CharacterSearchDialog
                open={imageSearchOpen}
                onOpenChange={setImageSearchOpen}
                searchQuery={`${game.name} ${name}`.trim()}
                onImageSelect={(base64) => {
                    setPortraitImage(base64);
                    setImageSearchOpen(false);
                }}
            />
        </>
    );
}
