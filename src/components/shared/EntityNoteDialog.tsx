import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EntityNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorId: string;
  entityName: string;
  value: string;
  onValueChange: (value: string) => void;
  onSave: () => void;
}

export function EntityNoteDialog({
  open,
  onOpenChange,
  editorId,
  entityName,
  value,
  onValueChange,
  onSave,
}: EntityNoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
          <DialogDescription>
            Update notes for {entityName}. Markdown is supported.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={editorId}>Note</Label>
          <Textarea
            id={editorId}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            rows={8}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save Note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
