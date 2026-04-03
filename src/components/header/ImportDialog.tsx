import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChooseFile: (includeVideos: boolean, includeSettings: boolean) => void;
}

export function ImportDialog({
    open,
    onOpenChange,
    onChooseFile,
}: ImportDialogProps) {
    const [includeVideos, setIncludeVideos] = useState(true);
    const [includeSettings, setIncludeSettings] = useState(false);

    useEffect(() => {
        if (open) {
            setIncludeVideos(true);
            setIncludeSettings(false);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-xs sm:max-w-md p-3 sm:p-6">
                <DialogHeader>
                    <DialogTitle>Import Data</DialogTitle>
                    <DialogDescription>
                        Choose what to include, then select a backup file.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <Label htmlFor="import-include-videos" className="text-sm">
                                Include demo videos
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Imports local demo files when present in the backup.
                            </p>
                        </div>
                        <Switch
                            id="import-include-videos"
                            checked={includeVideos}
                            onCheckedChange={setIncludeVideos}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <Label htmlFor="import-include-settings" className="text-sm">
                                Replace settings
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Applies settings from the backup and overwrites current preferences.
                            </p>
                        </div>
                        <Switch
                            id="import-include-settings"
                            checked={includeSettings}
                            onCheckedChange={setIncludeSettings}
                        />
                    </div>

                    <Button
                        onClick={() => onChooseFile(includeVideos, includeSettings)}
                        className="w-full"
                    >
                        Choose backup file
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
