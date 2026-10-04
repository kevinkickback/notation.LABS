import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  MoonIcon,
  SunIcon,
  XIcon,
} from '@phosphor-icons/react';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildComboPayload,
  createComboDraft,
} from '@/components/combo/comboDraft';
import { SortableComboCard } from '@/components/combo/SortableComboCard';
import { VideoPlayerDialog } from '@/components/combo/VideoPlayerDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SettingsProvider,
  useSettings,
  useSettingsActions,
} from '@/context/SettingsContext';
import { parseComboNotation } from '@/lib/parser';
import { hasTag } from '@/lib/tags';
import type { Combo, Game } from '@/lib/types';
import '@/main.css';
import './preview.css';

const game: Game = {
  id: 'sample-game',
  name: 'Sample fighter',
  notationProfile: 'standard',
  buttonLayout: ['L', 'M', 'H', 'S'],
  buttonColors: {
    L: 'var(--preview-button-l)',
    M: 'var(--preview-button-m)',
    H: 'var(--preview-button-h)',
    S: 'var(--preview-button-s)',
  },
  createdAt: 0,
  updatedAt: 0,
};
const samples: Combo[] = [
  {
    name: 'Midscreen staple',
    notation: '2L > 5M > 5H xx 236H',
    description:
      'A reliable starter. **Delay 5H slightly** to keep the opponent grounded.',
    difficulty: 2,
    damage: '3,420',
    meterCost: 'Meterless',
    tags: ['bread & butter', 'midscreen'],
    demoUrl: 'sample:demo',
  },
  {
    name: 'Corner carry into knockdown',
    notation: '5M > 2H > jc. > j.M > j.H > j.S > 66 > 5M xx 236H > 214S',
    description:
      'Use near the corner.\n- Keep the jump cancel low.\n- End with **214S** for a safe knockdown.',
    difficulty: 4,
    damage: '4,860',
    meterCost: '1 bar',
    tags: ['corner', 'knockdown'],
    demoUrl: 'sample:demo',
  },
  {
    name: 'Counter-hit conversion',
    notation: 'CH 5H > 66 > 5M > 2H > j.M > j.H xx 236H',
    description: 'Check the timing after the latest patch.',
    difficulty: 3,
    damage: '4,120',
    meterCost: 'Meterless',
    tags: ['counter hit'],
    outdated: true,
  },
  { name: 'Quick punish', notation: '5L > 5M xx 236L', tags: [] },
].map((sample, index) => ({
  ...sample,
  id: `sample-${index}`,
  characterId: 'sample-character',
  parsedNotation: parseComboNotation(sample.notation, game.buttonLayout, {
    profile: game.notationProfile,
  }),
  sortOrder: index,
  createdAt: 0,
  updatedAt: 0,
}));

function Preview() {
  const settings = useSettings();
  const { setSetting } = useSettingsActions();
  const [combos, setCombos] = useState(samples);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [deleting, setDeleting] = useState<Combo | null>(null);
  const [demo, setDemo] = useState<Combo | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<string | null>(null);
  const [message, setMessage] = useState(
    'Try the controls. Changes stay in this sample library.',
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(
    () => () => {
      if (videoRef.current) URL.revokeObjectURL(videoRef.current);
    },
    [],
  );
  const visible = combos.filter(
    (combo) => !filter || hasTag(combo.tags, filter),
  );
  const toggleSelect = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const duplicate = (combo: Combo) => {
    const copy = {
      ...combo,
      id: crypto.randomUUID(),
      name: `${combo.name} (copy)`,
    };
    setCombos((current) => {
      const next = [...current];
      next.splice(
        current.findIndex((item) => item.id === combo.id) + 1,
        0,
        copy,
      );
      return next;
    });
    setMessage(`Duplicated ${combo.name}.`);
  };
  const reorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setCombos((current) =>
      arrayMove(
        current,
        current.findIndex((combo) => combo.id === active.id),
        current.findIndex((combo) => combo.id === over.id),
      ),
    );
    setMessage('Combo order updated.');
  };
  const reset = () => {
    setCombos(samples);
    setSelected([]);
    setSelecting(false);
    setFilter('');
    setMessage('Sample library reset.');
  };
  const loadVideo = (file?: File) => {
    if (!file) return;
    if (videoRef.current) URL.revokeObjectURL(videoRef.current);
    videoRef.current = URL.createObjectURL(file);
    setVideoUrl(videoRef.current);
  };
  const card = (combo: Combo) => (
    <SortableComboCard
      key={combo.id}
      combo={combo}
      game={game}
      displayMode={settings.displayMode}
      isSelecting={selecting}
      isSelected={selected.includes(combo.id)}
      isDragDisabled={!!filter}
      onToggleSelect={toggleSelect}
      onEdit={setEditing}
      onDuplicate={duplicate}
      onDelete={(id) =>
        setDeleting(combos.find((combo) => combo.id === id) ?? null)
      }
      onWatchDemo={setDemo}
      onTagClick={setFilter}
    />
  );
  return (
    <div className="combo-preview">
      <header className="preview-header">
        <a href="/combo-card-preview.html" className="preview-brand">
          notation<span>.LABS</span>
        </a>
        <span className="preview-header-label">Combo card previews</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setSetting(
              'colorTheme',
              settings.colorTheme === 'dark' ? 'light' : 'dark',
            )
          }
          aria-label={`Switch to ${settings.colorTheme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {settings.colorTheme === 'dark' ? (
            <SunIcon size={18} />
          ) : (
            <MoonIcon size={18} />
          )}
          <span>{settings.colorTheme === 'dark' ? 'Light' : 'Dark'}</span>
        </Button>
      </header>
      <main className="preview-main">
        <div className="preview-intro">
          <p className="preview-eyebrow">SAMPLE LIBRARY / STANDARD NOTATION</p>
          <h1>Combo cards</h1>
          <p>Notation first. Try the updated cards in both themes.</p>
        </div>
        <div className="preview-toolbar">
          <div className="preview-toolbar-start">
            <h2>
              Practice combos <span>{visible.length}</span>
            </h2>
            {filter && (
              <button
                type="button"
                className="preview-filter"
                onClick={() => setFilter('')}
              >
                #{filter}
                <XIcon size={14} />
                <span className="sr-only">Clear filter</span>
              </button>
            )}
          </div>
          <div className="preview-controls">
            <label>
              Display
              <select
                aria-label="Display mode"
                value={settings.displayMode}
                onChange={(event) =>
                  setSetting(
                    'displayMode',
                    event.target.value as 'colored-text' | 'visual-icons',
                  )
                }
              >
                <option value="colored-text">Text</option>
                <option value="visual-icons">Icons</option>
              </select>
            </label>
            <label>
              Inputs
              <select
                aria-label="Motion style"
                value={settings.motionIconStyle}
                onChange={(event) =>
                  setSetting(
                    'motionIconStyle',
                    event.target.value as 'joystick' | 'arrows',
                  )
                }
              >
                <option value="joystick">Joystick</option>
                <option value="arrows">Arrows</option>
              </select>
            </label>
            <Button
              variant={selecting ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={selecting}
              onClick={() => {
                setSelecting(!selecting);
                setSelected([]);
              }}
            >
              <CheckIcon size={16} />
              Select
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reset sample library"
              title="Reset sample library"
              onClick={reset}
            >
              <ArrowCounterClockwiseIcon size={18} />
            </Button>
          </div>
        </div>
        {selecting && (
          <div className="preview-selection">
            <span>{selected.length} selected</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected(
                  selected.length === visible.length
                    ? []
                    : visible.map((combo) => combo.id),
                )
              }
            >
              {selected.length === visible.length
                ? 'Deselect all'
                : 'Select all'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!selected.length}
              onClick={() => {
                setCombos((current) =>
                  current.filter((combo) => !selected.includes(combo.id)),
                );
                setMessage(`Deleted ${selected.length} sample combos.`);
                setSelected([]);
              }}
            >
              Delete selected
            </Button>
          </div>
        )}
        {visible.length === 0 ? (
          <div className="preview-empty">
            <p>No sample combos here.</p>
            <Button variant="outline" onClick={reset}>
              Reset sample library
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reorder}
          >
            <SortableContext
              items={visible.map((combo) => combo.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="preview-card-list">{visible.map(card)}</div>
            </SortableContext>
          </DndContext>
        )}
        <footer className="preview-footer">
          <output aria-live="polite">{message}</output>
          <span>Your actual library is untouched.</span>
        </footer>
      </main>
      {editing && (
        <SampleEditor
          combo={editing}
          onClose={() => setEditing(null)}
          onSave={(updated) => {
            setCombos((current) =>
              current.map((combo) =>
                combo.id === updated.id ? updated : combo,
              ),
            );
            setEditing(null);
            setMessage(`Updated ${updated.name}.`);
          }}
        />
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete sample combo?</DialogTitle>
            <DialogDescription>{deleting?.name}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCombos((current) =>
                  current.filter((combo) => combo.id !== deleting?.id),
                );
                setSelected((current) =>
                  current.filter((id) => id !== deleting?.id),
                );
                setMessage('Sample combo deleted.');
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {demo && !videoUrl && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDemo(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{demo.name} — Demo</DialogTitle>
              <DialogDescription>
                Choose a video to try the demo player. It stays on your device.
              </DialogDescription>
            </DialogHeader>
            <label className="preview-upload">
              Sample demo video
              <input
                type="file"
                accept="video/*"
                onChange={(event) => loadVideo(event.target.files?.[0])}
              />
            </label>
          </DialogContent>
        </Dialog>
      )}
      {demo && videoUrl && (
        <VideoPlayerDialog
          open
          onClose={() => setDemo(null)}
          videoUrl={videoUrl}
          title={demo.name}
          videoSize={settings.videoPlayerSize}
          onVideoSizeChange={(size) => setSetting('videoPlayerSize', size)}
        />
      )}
    </div>
  );
}

function SampleEditor({
  combo,
  onClose,
  onSave,
}: {
  combo: Combo;
  onClose: () => void;
  onSave: (combo: Combo) => void;
}) {
  const fieldId = useId();
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (name: string) => String(values.get(name) ?? '');
    const draft = {
      ...createComboDraft(combo),
      name: text('name'),
      notation: text('notation'),
      description: text('description'),
      damage: text('damage'),
      difficulty: text('difficulty'),
      meterCost: text('meterCost'),
      tags: text('tags')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      outdated: values.has('outdated'),
    };
    const payload = buildComboPayload(draft);
    onSave({
      ...combo,
      ...payload,
      parsedNotation: parseComboNotation(payload.notation, game.buttonLayout, {
        profile: game.notationProfile,
      }),
    });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="preview-editor">
        <DialogHeader>
          <DialogTitle>Edit sample combo</DialogTitle>
          <DialogDescription>
            Changes apply to this preview only.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="preview-editor-form">
          <label>
            Name
            <input name="name" defaultValue={combo.name} required />
          </label>
          <div className="preview-editor-field">
            <label htmlFor={`${fieldId}-notation`}>Notation</label>
            <textarea
              id={`${fieldId}-notation`}
              name="notation"
              defaultValue={combo.notation}
              required
            />
          </div>
          <div className="preview-editor-grid">
            <label>
              Damage
              <input name="damage" defaultValue={combo.damage} />
            </label>
            <label>
              Meter cost
              <input name="meterCost" defaultValue={combo.meterCost} />
            </label>
            <label>
              Difficulty
              <select name="difficulty" defaultValue={combo.difficulty ?? ''}>
                <option value="">None</option>
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {level}/5
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Tags, separated by commas
            <input name="tags" defaultValue={combo.tags.join(', ')} />
          </label>
          <div className="preview-editor-field">
            <label htmlFor={`${fieldId}-description`}>Description</label>
            <textarea
              id={`${fieldId}-description`}
              name="description"
              defaultValue={combo.description}
            />
          </div>
          <label className="preview-editor-checkbox">
            <input
              type="checkbox"
              name="outdated"
              defaultChecked={combo.outdated}
            />
            Outdated
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <SettingsProvider>
      <Preview />
    </SettingsProvider>,
  );
