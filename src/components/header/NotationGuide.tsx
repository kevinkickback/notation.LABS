import { BookOpenIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { MotionIcon } from '@/components/combo/icons/MotionIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/context/SettingsContext';
import {
  COMMON_SYNTAX,
  DIRECTION_REFERENCE_DESCRIPTIONS,
  DIRECTION_REFERENCES,
  type GuideEntry,
  PROFILE_GUIDES,
  PROFILE_INPUT_SYNTAX,
} from '@/lib/notationGuideData';
import {
  getNotationProfileDefinition,
  NOTATION_PROFILES,
} from '@/lib/notationProfiles';
import { parseComboNotation } from '@/lib/parser';
import type { Game, NotationProfile } from '@/lib/types';

interface NotationGuideProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  activeGame?: Game;
}

export function NotationGuide({
  open,
  onOpenChange,
  showTrigger = true,
  activeGame,
}: NotationGuideProps) {
  const initialProfile = activeGame?.notationProfile ?? 'standard';
  const [profile, setProfile] = useState<NotationProfile>(initialProfile);
  const [previewNotation, setPreviewNotation] = useState(
    getNotationProfileDefinition(initialProfile).example,
  );
  const previewInputId = useId();
  useEffect(() => {
    if (!open) return;
    const next = activeGame?.notationProfile ?? 'standard';
    setProfile(next);
    setPreviewNotation(getNotationProfileDefinition(next).example);
  }, [open, activeGame]);
  const definition = getNotationProfileDefinition(profile);
  const guide = PROFILE_GUIDES[profile];
  const previewGame = useMemo<Game>(
    () => ({
      id: 'notation-guide-preview',
      name: definition.label,
      notationProfile: profile,
      buttonLayout: definition.defaultButtons,
      createdAt: 0,
      updatedAt: 0,
    }),
    [profile, definition],
  );
  const previewTokens = useMemo(
    () =>
      parseComboNotation(previewNotation, previewGame.buttonLayout, {
        profile,
      }),
    [previewNotation, previewGame, profile],
  );
  const selectProfile = (value: string) => {
    const next = value as NotationProfile;
    setProfile(next);
    setPreviewNotation(getNotationProfileDefinition(next).example);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            title="Notation Guide"
            aria-label="Notation guide"
          >
            <BookOpenIcon className="size-6" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="notation-guide-dialog max-w-[922px] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Combo Notation Guide</DialogTitle>
          <DialogDescription className="sr-only">
            Look up an input. Try a sequence. See how it reads.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={profile}
          onValueChange={selectProfile}
          className="guide-tabs min-h-0 flex-1"
        >
          <TabsList className="guide-profile-tabs" aria-label="Notation style">
            {NOTATION_PROFILES.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={profile} className="guide-workspace min-h-0">
            <section
              className="guide-reference"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: This scroll region needs keyboard access.
              tabIndex={0}
              aria-label={`${definition.shortLabel} notation reference`}
            >
              <p className="guide-profile-description text-sm text-muted-foreground">
                {definition.description}
              </p>
              <DirectionsCard
                profile={profile}
                entries={guide.directionRules}
              />
              <GuideCard
                title={`${definition.shortLabel} Supported Syntax`}
                entries={[
                  ...COMMON_SYNTAX,
                  ...PROFILE_INPUT_SYNTAX[profile],
                  ...guide.separators,
                ]}
              />
              <GuideCard title="Mechanics & States" entries={guide.mechanics} />
              <GuideCard
                title="Community Examples"
                entries={guide.examples}
                onTry={setPreviewNotation}
              />
            </section>
            <div className="guide-live-preview">
              <section className="guide-section">
                <h3>Live Preview</h3>
                <p className="guide-section-description">
                  Type a sequence or select a community example.
                </p>
                <div className="guide-preview-fields">
                  <div>
                    <Label htmlFor={previewInputId}>Notation</Label>
                    <Textarea
                      id={previewInputId}
                      value={previewNotation}
                      onChange={(event) =>
                        setPreviewNotation(event.target.value)
                      }
                      className="font-mono min-h-24 resize-y"
                    />
                  </div>
                  <div aria-live="polite" aria-atomic="true">
                    <PreviewPanel label="Text">
                      <ComboDisplay
                        tokens={previewTokens}
                        game={previewGame}
                        mode="colored-text"
                      />
                    </PreviewPanel>
                    <PreviewPanel label="Icons">
                      <ComboDisplay
                        tokens={previewTokens}
                        game={previewGame}
                        mode="visual-icons"
                      />
                    </PreviewPanel>
                  </div>
                </div>
              </section>
              <MotionStyleCallout />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
function DirectionsCard({
  profile,
  entries,
}: {
  profile: NotationProfile;
  entries: GuideEntry[];
}) {
  const profileDefinition = getNotationProfileDefinition(profile);

  return (
    <section className="guide-section">
      <header>
        <h3>Directions</h3>
        <p className="guide-section-description">
          {DIRECTION_REFERENCE_DESCRIPTIONS[profile]}
        </p>
      </header>
      <div className="guide-directions-layout">
        <div className="guide-direction-board space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Directional Reference
          </h4>
          <ul
            className="guide-direction-pad"
            aria-label={`${profileDefinition.shortLabel} direction notation`}
          >
            {DIRECTION_REFERENCES[profile].map((entry) => (
              <li
                key={`${entry.notation}-${entry.meaning}`}
                className="min-w-0 rounded-md border border-border bg-muted/30 px-2 py-2 text-center"
                aria-label={`${entry.meaning}: ${entry.notation}`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <code className="font-mono text-sm font-semibold text-primary">
                    {entry.notation}
                  </code>
                  <span
                    aria-hidden="true"
                    className="text-base text-foreground"
                  >
                    {entry.symbol}
                  </span>
                </div>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {entry.meaning}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="guide-direction-rules space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Parsing Rules
          </h4>
          <GuideGrid entries={entries} />
        </div>
      </div>
    </section>
  );
}

function GuideCard({
  title,
  entries,
  onTry,
}: {
  title: string;
  entries: GuideEntry[];
  onTry?: (value: string) => void;
}) {
  return (
    <section className="guide-section">
      <header>
        <h3>{title}</h3>
      </header>
      <div>
        <GuideGrid entries={entries} onTry={onTry} />
      </div>
    </section>
  );
}

function GuideGrid({
  entries,
  onTry,
}: {
  entries: GuideEntry[];
  onTry?: (value: string) => void;
}) {
  return (
    <dl className={onTry ? 'guide-entries guide-examples' : 'guide-entries'}>
      {entries.map((entry) => (
        <div
          key={`${entry.notation}-${entry.meaning}`}
          className="space-y-0.5 py-2 first:pt-0 last:pb-0"
        >
          <dt>
            {onTry ? (
              <button
                type="button"
                aria-label={`Try ${entry.notation}`}
                onClick={() => onTry(entry.notation)}
              >
                <code>{entry.notation}</code>
                <span className="guide-example-action" aria-hidden="true">
                  Try ↗
                </span>
              </button>
            ) : (
              <code>{entry.notation}</code>
            )}
          </dt>
          <dd className="text-sm text-muted-foreground">{entry.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

function MotionStyleCallout() {
  const { motionIconStyle } = useSettings();
  const offersJoystick = motionIconStyle === 'arrows';
  const examples = [
    { label: 'Tap Forward', motion: offersJoystick ? '6' : 'f' },
    {
      label: 'Hold Forward',
      motion: offersJoystick ? '6' : 'F',
      hold: true,
    },
    { label: 'Quarter Circle', motion: '236' },
  ];

  return (
    <div className="guide-motion-settings">
      <p className="text-sm font-medium text-foreground">
        Want {offersJoystick ? 'joystick' : 'arrow'} inputs?
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Open Settings → Notation → Motion Style and choose{' '}
        {offersJoystick ? 'Joystick' : 'Arrows'}.{' '}
        {offersJoystick
          ? 'Joystick inputs show complete motion paths in a single diagram.'
          : 'Tekken tap and hold arrows use different shapes; neutral uses a star.'}
      </p>
      <fieldset className="guide-motion-examples">
        <legend className="sr-only">
          {offersJoystick ? 'Joystick' : 'Arrow'} input examples
        </legend>
        {examples.map((example) => (
          <IconExample
            key={example.label}
            {...example}
            iconStyle={offersJoystick ? 'joystick' : 'arrows'}
          />
        ))}
      </fieldset>
    </div>
  );
}

function IconExample({
  label,
  motion,
  iconStyle,
  hold = false,
}: {
  label: string;
  motion: string;
  iconStyle: 'joystick' | 'arrows';
  hold?: boolean;
}) {
  return (
    <div className="guide-motion-example">
      <MotionIcon
        motion={motion}
        iconStyle={iconStyle}
        size={34}
        label={`${label} example`}
        hold={hold}
      />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function PreviewPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="guide-preview-output min-w-0">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
