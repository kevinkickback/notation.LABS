import { PlayIcon, VideoCameraIcon, XIcon } from '@phosphor-icons/react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { FormSection } from '@/components/shared/FormSection';
import { RequiredBadge } from '@/components/shared/RequiredBadge';
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
import { useMediaRequest } from '@/hooks/useMediaRequest';
import { useSubmission } from '@/hooks/useSubmission';
import { createCombo, updateCombo } from '@/lib/application/comboCommands';
import { reportError } from '@/lib/errors';
import { extractYouTubeVideoId, fetchYouTubeTitle } from '@/lib/media/youtube';
import { notify } from '@/lib/notifications';
import { parseComboNotation } from '@/lib/parser';
import {
  type DemoVideo,
  generateId,
  getLocalVideoId,
} from '@/lib/storage/indexedDbStorage';
import { getTagTone, hasTag, tagKey, uniqueTags } from '@/lib/tags';
import type { Character, Combo, Game } from '@/lib/types';
import {
  buildComboPayload,
  type ComboDraft,
  createComboDraft,
} from './comboDraft';

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

export function ComboFormDialog({
  open,
  onOpenChange,
  game,
  character,
  editingCombo,
  allTags,
}: ComboFormDialogProps) {
  const [draft, setDraft] = useState(() => createComboDraft());
  const {
    name,
    notation,
    description,
    difficulty,
    damage,
    meterCost,
    tags,
    demoUrl,
    demoFileName,
    demoVideoTitle,
    outdated,
  } = draft;
  const updateDraft = useCallback((updates: Partial<ComboDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
  }, []);
  const [tagInput, setTagInput] = useState('');
  const [pendingVideo, setPendingVideo] = useState<DemoVideo | undefined>();
  const { pending, submit } = useSubmission(
    open,
    `${character.id}:${editingCombo?.id ?? 'new'}`,
  );
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const outdatedToggleId = useId();
  const isDesktop = !!window.electronAPI;
  const { run: loadVideo, cancel: cancelVideo } = useMediaRequest(
    open,
    `${character.id}:${editingCombo?.id ?? 'new'}`,
  );

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: A different character starts a new unsaved combo draft.
  useEffect(() => {
    setDraft(createComboDraft(open ? editingCombo : null));
    setTagInput('');
    setPendingVideo(undefined);
  }, [open, character.id, editingCombo]);

  // Fetch YouTube video title when URL changes
  useEffect(() => {
    if (!open || !demoUrl || getLocalVideoId(demoUrl)) {
      updateDraft({ demoVideoTitle: '' });
      return;
    }
    const videoId = extractYouTubeVideoId(demoUrl);
    if (!videoId) {
      updateDraft({ demoVideoTitle: '' });
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      fetchYouTubeTitle(demoUrl, controller.signal)
        .then((title) => {
          if (!controller.signal.aborted)
            updateDraft({ demoVideoTitle: title });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          if (!controller.signal.aborted) updateDraft({ demoVideoTitle: '' });
        });
    }, 350);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [demoUrl, open, updateDraft]);

  const handleSubmit = async () => {
    if (!name.trim() || !notation.trim()) {
      notify.error('Name and notation are required', { history: false });
      return;
    }

    await submit(
      async () => {
        const payload = buildComboPayload(draft);
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
      },
      {
        onSuccess: () => {
          notify.success(editingCombo ? 'Combo updated' : 'Combo added');
          onOpenChange(false);
        },
        onError: (error) => {
          reportError('ComboFormDialog.handleSubmit', error);
          notify.error(
            editingCombo ? 'Failed to update combo' : 'Failed to add combo',
          );
        },
      },
    );
  };

  const handleVideoFileSelect = () => videoFileInputRef.current?.click();

  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
      notify.error('Unsupported video format', { history: false });
      return;
    }

    if (file.size > SOFT_WARN_VIDEO_SIZE_BYTES) {
      notify.warning(
        `This video will use ${(file.size / 1024 / 1024).toFixed(1)} MB of local storage.`,
      );
    }

    await loadVideo(file.name, () => Promise.resolve(file), {
      onSuccess: (blob) => {
        const videoId = generateId();
        setPendingVideo({
          id: videoId,
          data: blob,
          mimeType: file.type,
          fileName: file.name,
        });
        updateDraft({
          demoUrl: `local:${videoId}`,
          demoFileName: file.name,
          demoVideoTitle: '',
        });
      },
      onError: (err) => {
        reportError('ComboFormDialog.handleVideoFileChange', err);
        notify.error('Failed to read video file');
      },
    });
  };

  const localDemoVideoId = getLocalVideoId(demoUrl);
  const tagSuggestions = useMemo(
    () => uniqueTags(allTags).filter((tag) => !hasTag(tags, tag)),
    [allTags, tags],
  );

  const commitTag = (value: string) => {
    const val = value.trim();
    if (val && !hasTag(tags, val)) {
      const spelling =
        allTags.find((tag) => tagKey(tag) === tagKey(val)) ?? val;
      const updated = [...tags, spelling.trim()];
      updateDraft({ tags: updated });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const updated = tags.filter((value) => tagKey(value) !== tagKey(tag));
    updateDraft({ tags: updated });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && tagInput.trim()) {
      const match = tagSuggestions.find((t) =>
        tagKey(t).startsWith(tagKey(tagInput)),
      );
      if (match) {
        e.preventDefault();
        commitTag(match);
      }
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[792px] dialog-form combo-form-dialog flex flex-col overflow-hidden">
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
              {editingCombo ? 'Edit' : 'Add'} Combo for {character.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enter the combo notation, details, and optional demo video.
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={pending} inert={pending} className="contents">
            <DialogBody className="dialog-editor-grid">
              <FormSection>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={comboNameId}>Combo Name</Label>
                    <RequiredBadge />
                  </div>
                  <Input
                    id={comboNameId}
                    required
                    value={name}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                    placeholder="BnB Corner Combo"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={comboNotationId}>Notation</Label>
                    <RequiredBadge />
                  </div>
                  <Textarea
                    id={comboNotationId}
                    required
                    value={notation}
                    onChange={(e) => updateDraft({ notation: e.target.value })}
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
              </FormSection>

              <FormSection>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="min-w-0">
                    <Label htmlFor={comboDifficultyId}>Difficulty</Label>
                    <Select
                      value={difficulty}
                      onValueChange={(value) =>
                        updateDraft({ difficulty: value })
                      }
                    >
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
                      onChange={(e) => updateDraft({ damage: e.target.value })}
                      placeholder="4200"
                    />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor={comboMeterId}>Meter Cost</Label>
                    <Input
                      id={comboMeterId}
                      value={meterCost}
                      onChange={(e) =>
                        updateDraft({ meterCost: e.target.value })
                      }
                      placeholder="1 bar"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={comboTagsId}>Tags</Label>
                  <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="combo-tag gap-1 cursor-pointer shrink-0"
                        data-tone={getTagTone(tag)}
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
                        tags.length > 0
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
              </FormSection>

              <FormSection>
                <Label htmlFor={comboDemoUrlId}>Video Demo</Label>
                <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_auto] sm:gap-3">
                  <Input
                    id={comboDemoUrlId}
                    value={localDemoVideoId ? '' : demoUrl}
                    onChange={(e) => {
                      cancelVideo();
                      updateDraft({ demoUrl: e.target.value });
                      updateDraft({ demoVideoTitle: '' });
                      updateDraft({ demoFileName: '' });
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
                {demoUrl && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-md min-w-0 overflow-hidden">
                    <PlayIcon
                      className="w-4 h-4 text-accent-text shrink-0"
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
                        cancelVideo();
                        updateDraft({
                          demoUrl: '',
                          demoFileName: '',
                          demoVideoTitle: '',
                        });
                        setPendingVideo(undefined);
                      }}
                    >
                      <XIcon className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </FormSection>

              <FormSection>
                <div>
                  <Label htmlFor={comboDescriptionId}>Description</Label>
                  <Textarea
                    id={comboDescriptionId}
                    aria-describedby={comboDescriptionHelpId}
                    value={description}
                    onChange={(e) =>
                      updateDraft({ description: e.target.value })
                    }
                    rows={3}
                    placeholder="Works in the corner after any starter..."
                  />
                  <p
                    id={comboDescriptionHelpId}
                    className="mt-1.5 text-xs text-muted-foreground"
                  >
                    Markdown supported.
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
                  </div>
                  <Switch
                    id={outdatedToggleId}
                    checked={outdated}
                    onCheckedChange={(value) =>
                      updateDraft({ outdated: value })
                    }
                  />
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
