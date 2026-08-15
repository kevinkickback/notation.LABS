import { PlayIcon, VideoCameraIcon, XIcon } from '@phosphor-icons/react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { createCombo, updateCombo } from '@/lib/application/comboCommands';
import { MAX_VIDEO_SIZE_BYTES } from '@/lib/defaults';
import { reportError } from '@/lib/errors';
import { parseComboNotation } from '@/lib/parser';
import {
  type DemoVideo,
  generateId,
  getLocalVideoId,
} from '@/lib/storage/indexedDbStorage';
import type { Character, Combo, Game } from '@/lib/types';
import { extractYouTubeVideoId } from '@/lib/utils';

const SOFT_WARN_VIDEO_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
];

interface ComboFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game;
  character: Character;
  editingCombo: Combo | null;
  allTags: string[];
}

import { ComboFormSection } from './ComboFormSection';

export function ComboFormDialog({
  open,
  onOpenChange,
  game,
  character,
  editingCombo,
  allTags,
}: ComboFormDialogProps) {
  const [name, setName] = useState('');
  const [notation, setNotation] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [damage, setDamage] = useState('');
  const [meterCost, setMeterCost] = useState('');
  const [tags, setTags] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [demoFileName, setDemoFileName] = useState('');
  const [demoVideoTitle, setDemoVideoTitle] = useState('');
  const [pendingVideo, setPendingVideo] = useState<DemoVideo | undefined>();
  const [outdated, setOutdated] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const outdatedToggleId = useId();
  const isDesktop = !!window.electronAPI;

  const comboNameId = useId();
  const comboNotationId = useId();
  const comboDifficultyId = useId();
  const comboDamageId = useId();
  const comboMeterId = useId();
  const comboTagsId = useId();
  const comboDemoUrlId = useId();
  const comboDescriptionId = useId();
  const comboDescriptionHelpId = useId();
  const tagSuggestionsId = useId();

  const parsedNotationTokens = useMemo(
    () =>
      parseComboNotation(notation, game.buttonLayout, {
        profile: game.notationProfile,
      }),
    [notation, game],
  );

  const resetForm = useCallback(() => {
    setName('');
    setNotation('');
    setDescription('');
    setDifficulty('');
    setDamage('');
    setMeterCost('');
    setTags('');
    setTagInput('');
    setDemoUrl('');
    setDemoFileName('');
    setDemoVideoTitle('');
    setPendingVideo(undefined);
    setOutdated(false);
  }, []);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm],
  );

  useEffect(() => {
    if (editingCombo) {
      setName(editingCombo.name);
      setNotation(editingCombo.notation);
      setDescription(editingCombo.description || '');
      setDifficulty(
        editingCombo.difficulty ? editingCombo.difficulty.toString() : '',
      );
      setDamage(editingCombo.damage || '');
      setMeterCost(editingCombo.meterCost || '');
      setTags(editingCombo.tags.join(', '));
      setDemoUrl(editingCombo.demoUrl || '');
      setDemoFileName(editingCombo.demoFileName || '');
      setDemoVideoTitle(editingCombo.demoVideoTitle || '');
      setPendingVideo(undefined);
      setOutdated(editingCombo.outdated || false);
    } else {
      resetForm();
    }
  }, [editingCombo, resetForm]);

  // Fetch YouTube video title when URL changes
  useEffect(() => {
    if (!demoUrl || getLocalVideoId(demoUrl)) {
      setDemoVideoTitle('');
      return;
    }
    const videoId = extractYouTubeVideoId(demoUrl);
    if (!videoId) {
      setDemoVideoTitle('');
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      fetch(`https://noembed.com/embed?url=${encodeURIComponent(demoUrl)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.title) setDemoVideoTitle(data.title);
          else setDemoVideoTitle('');
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          setDemoVideoTitle('');
        });
    }, 350);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [demoUrl]);

  const buildComboPayload = () => ({
    name: name.trim(),
    notation: notation.trim(),
    description: description.trim(),
    difficulty: difficulty ? parseInt(difficulty, 10) : undefined,
    damage: damage.trim(),
    meterCost: meterCost.trim(),
    tags: tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    demoUrl: demoUrl.trim() || undefined,
    demoFileName: demoFileName || undefined,
    demoVideoTitle: demoVideoTitle || undefined,
    outdated: outdated || undefined,
  });

  const handleSubmit = async () => {
    if (!name.trim() || !notation.trim()) {
      toast.error('Name and notation are required');
      return;
    }

    try {
      const payload = buildComboPayload();
      if (editingCombo) {
        await updateCombo(editingCombo.id, payload, pendingVideo);
      } else {
        await createCombo(
          {
            characterId: character.id,
            ...payload,
          },
          pendingVideo,
        );
      }
      toast.success(editingCombo ? 'Combo updated' : 'Combo added');
      handleDialogOpenChange(false);
    } catch (err) {
      reportError('ComboFormDialog.handleSubmit', err);
      toast.error(
        editingCombo ? 'Failed to update combo' : 'Failed to add combo',
      );
    }
  };

  const handleVideoFileSelect = () => videoFileInputRef.current?.click();

  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      toast.error(
        'Video exceeds 50 MB limit. Please compress the file and try again.',
      );
      e.target.value = '';
      return;
    }

    if (file.size > SOFT_WARN_VIDEO_SIZE_BYTES) {
      toast.warning('Large files may affect app performance.');
    }

    if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
      toast.error('Unsupported video format');
      e.target.value = '';
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const videoId = generateId();
      setPendingVideo({
        id: videoId,
        data: buffer,
        mimeType: file.type,
        fileName: file.name,
      });
      setDemoUrl(`local:${videoId}`);
      setDemoFileName(file.name);
    } catch (err) {
      reportError('ComboFormDialog.handleVideoFileChange', err);
      toast.error('Failed to save video file');
    }
    e.target.value = '';
  };

  const currentTags = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const localDemoVideoId = getLocalVideoId(demoUrl);
  const tagSuggestions = useMemo(
    () => allTags.filter((t) => !currentTags.includes(t)),
    [allTags, currentTags],
  );

  const commitTag = (value: string) => {
    const val = value.trim();
    if (val && !currentTags.includes(val)) {
      const updated = [...currentTags, val];
      setTags(updated.join(', '));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const updated = currentTags.filter((t) => t !== tag);
    setTags(updated.join(', '));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && tagInput.trim()) {
      const match = tagSuggestions.find((t) =>
        t.toLowerCase().startsWith(tagInput.toLowerCase()),
      );
      if (match) {
        e.preventDefault();
        commitTag(match);
      }
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag(tagInput);
    } else if (
      e.key === 'Backspace' &&
      tagInput === '' &&
      currentTags.length > 0
    ) {
      removeTag(currentTags[currentTags.length - 1]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col overflow-hidden">
        <form
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <DialogHeader className="shrink-0 border-b border-border pb-4 pr-6">
            <DialogTitle>
              {editingCombo ? 'Edit' : 'Add'} Combo for {character.name}
            </DialogTitle>
            <DialogDescription>
              Enter the combo notation, details, and optional demo video.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="-mr-2 space-y-4 pr-2">
            <ComboFormSection
              title="Combo Basics"
              description="Name the combo, enter its notation, and confirm the parsed preview."
              required
            >
              <div>
                <Label htmlFor={comboNameId}>Combo Name</Label>
                <Input
                  id={comboNameId}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="BnB Corner Combo"
                />
              </div>

              <div>
                <Label htmlFor={comboNotationId}>Notation</Label>
                <Textarea
                  id={comboNotationId}
                  required
                  value={notation}
                  onChange={(e) => setNotation(e.target.value)}
                  placeholder="5L > 5L > 236H > 623M"
                  rows={3}
                  className="font-mono"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Available buttons:
                  </span>
                  {game.buttonLayout.map((btn) => (
                    <span
                      key={btn}
                      className="rounded bg-muted px-2 py-0.5 font-mono text-xs"
                    >
                      {btn}
                    </span>
                  ))}
                </div>
              </div>

              {notation && (
                <div className="rounded-lg bg-muted p-4">
                  <Label className="mb-2 block">Preview</Label>
                  <ComboDisplay tokens={parsedNotationTokens} game={game} />
                </div>
              )}
            </ComboFormSection>

            <ComboFormSection
              title="Combo Details"
              description="Record difficulty, damage, meter cost, and tags."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="min-w-0">
                  <Label htmlFor={comboDifficultyId}>Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger id={comboDifficultyId} className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 / 5</SelectItem>
                      <SelectItem value="2">2 / 5</SelectItem>
                      <SelectItem value="3">3 / 5</SelectItem>
                      <SelectItem value="4">4 / 5</SelectItem>
                      <SelectItem value="5">5 / 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label htmlFor={comboDamageId}>Damage</Label>
                  <Input
                    id={comboDamageId}
                    value={damage}
                    onChange={(e) => setDamage(e.target.value)}
                    placeholder="4200"
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor={comboMeterId}>Meter Cost</Label>
                  <Input
                    id={comboMeterId}
                    value={meterCost}
                    onChange={(e) => setMeterCost(e.target.value)}
                    placeholder="1 bar"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={comboTagsId}>Tags</Label>
                <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
                  {currentTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 cursor-pointer shrink-0"
                      onClick={() => removeTag(tag)}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Delete' ||
                          e.key === 'Backspace' ||
                          e.key === 'Enter'
                        ) {
                          e.preventDefault();
                          removeTag(tag);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Remove tag: ${tag}`}
                    >
                      {tag}
                      <XIcon className="w-3 h-3" />
                    </Badge>
                  ))}
                  <input
                    id={comboTagsId}
                    list={tagSuggestionsId}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => {
                      if (tagInput.trim()) commitTag(tagInput);
                    }}
                    placeholder={
                      currentTags.length > 0
                        ? 'Add tag...'
                        : 'BnB, Corner, Meterless'
                    }
                    className="flex-1 min-w-[100px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  />
                  <datalist id={tagSuggestionsId}>
                    {tagSuggestions.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </div>
              </div>
            </ComboFormSection>

            <ComboFormSection
              title="Demo Video"
              description="Link a YouTube video or attach a local video file."
            >
              <Label htmlFor={comboDemoUrlId} className="sr-only">
                YouTube demo URL
              </Label>
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_auto] sm:gap-3">
                <Input
                  id={comboDemoUrlId}
                  value={localDemoVideoId ? '' : demoUrl}
                  onChange={(e) => {
                    setDemoUrl(e.target.value);
                    setDemoFileName('');
                    setPendingVideo(undefined);
                  }}
                  placeholder="Paste a YouTube URL"
                  disabled={!!localDemoVideoId}
                />
                <span className="text-center text-xs font-medium text-muted-foreground">
                  OR
                </span>
                {isDesktop ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVideoFileSelect}
                    className="gap-2"
                  >
                    <VideoCameraIcon className="w-4 h-4" />
                    Upload File
                  </Button>
                ) : (
                  <span
                    title="Only available in the desktop app"
                    className="cursor-not-allowed"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      disabled
                      className="gap-2 pointer-events-none opacity-50"
                    >
                      <VideoCameraIcon className="w-4 h-4" />
                      Upload File
                    </Button>
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Max file size: 50 MB.
              </p>
              {demoUrl && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-md min-w-0 overflow-hidden">
                  <PlayIcon
                    className="w-4 h-4 text-primary shrink-0"
                    weight="fill"
                  />
                  <span className="text-xs text-muted-foreground truncate min-w-0">
                    {localDemoVideoId
                      ? demoFileName || 'Local video'
                      : demoVideoTitle || demoUrl}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 shrink-0"
                    onClick={() => {
                      setDemoUrl('');
                      setDemoFileName('');
                      setDemoVideoTitle('');
                      setPendingVideo(undefined);
                    }}
                  >
                    <XIcon className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </ComboFormSection>

            <ComboFormSection
              title="Description & Status"
              description="Add context and flag combos that may need review after a game update."
            >
              <div>
                <Label htmlFor={comboDescriptionId}>Description</Label>
                <Textarea
                  id={comboDescriptionId}
                  aria-describedby={comboDescriptionHelpId}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Works in the corner after any starter..."
                />
                <p
                  id={comboDescriptionHelpId}
                  className="mt-1.5 text-xs text-muted-foreground"
                >
                  Multiple lines and Markdown are supported.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor={outdatedToggleId}
                    className="text-sm font-medium"
                  >
                    Mark as outdated
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Flag this combo as potentially outdated due to a game patch
                  </p>
                </div>
                <Switch
                  id={outdatedToggleId}
                  checked={outdated}
                  onCheckedChange={setOutdated}
                />
              </div>
            </ComboFormSection>
          </DialogBody>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingCombo ? 'Update' : 'Add'} Combo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <input
        ref={videoFileInputRef}
        type="file"
        accept={ALLOWED_VIDEO_MIME_TYPES.join(',')}
        className="hidden"
        onChange={handleVideoFileChange}
      />
    </Dialog>
  );
}
