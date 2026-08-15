import { BookOpenIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { MotionIcon } from '@/components/combo/icons/MotionIcon';
import { Button } from '@/components/ui/button';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    const nextProfile = activeGame?.notationProfile ?? 'standard';
    setProfile(nextProfile);
    setPreviewNotation(getNotationProfileDefinition(nextProfile).example);
  }, [open, activeGame]);

  const profileDefinition = getNotationProfileDefinition(profile);
  const guide = PROFILE_GUIDES[profile];
  const previewGame = useMemo<Game>(
    () => ({
      id: 'notation-guide-preview',
      name: profileDefinition.label,
      notationProfile: profile,
      buttonLayout: profileDefinition.defaultButtons,
      createdAt: 0,
      updatedAt: 0,
    }),
    [profile, profileDefinition],
  );
  const previewTokens = useMemo(
    () =>
      parseComboNotation(previewNotation, previewGame.buttonLayout, {
        profile,
      }),
    [previewNotation, previewGame, profile],
  );

  const handleProfileChange = (nextProfile: NotationProfile) => {
    setProfile(nextProfile);
    setPreviewNotation(getNotationProfileDefinition(nextProfile).example);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
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
      ) : null}
      <DialogContent className="flex max-w-4xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0 border-b border-border pb-4 pr-6">
          <DialogTitle className="font-mono text-2xl">
            Combo Notation Guide
          </DialogTitle>
          <DialogDescription>
            Community notation reference with live text and icon previews.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="-mr-2 pr-2">
          <Tabs
            value={profile}
            onValueChange={(value) =>
              handleProfileChange(value as NotationProfile)
            }
            className="gap-4"
          >
            <TabsList
              className="grid w-full grid-cols-3"
              aria-label="Notation style"
            >
              {NOTATION_PROFILES.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={profile} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {profileDefinition.description}
              </p>

              <DirectionsCard
                profile={profile}
                entries={guide.directionRules}
              />

              <GuideCard
                title={`${profileDefinition.shortLabel} Supported Syntax`}
                entries={[
                  ...COMMON_SYNTAX,
                  ...PROFILE_INPUT_SYNTAX[profile],
                  ...guide.separators,
                ]}
              />

              <GuideCard title="Mechanics & States" entries={guide.mechanics} />
              <GuideCard title="Community Examples" entries={guide.examples} />

              <Card className="gap-3 py-4 shadow-none">
                <CardHeader className="gap-1 px-4">
                  <CardTitle className="text-sm">Live Preview</CardTitle>
                  <CardDescription className="text-xs">
                    Edit the notation to compare preserved text with its visual
                    interpretation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                  <div>
                    <Label htmlFor={previewInputId}>Notation</Label>
                    <Input
                      id={previewInputId}
                      value={previewNotation}
                      onChange={(event) =>
                        setPreviewNotation(event.target.value)
                      }
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div className="space-y-3">
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
                </CardContent>
              </Card>

              <MotionStyleCallout />
            </TabsContent>
          </Tabs>
        </DialogBody>
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
    <Card className="gap-3 py-4 shadow-none">
      <CardHeader className="gap-1 px-4">
        <CardTitle className="text-sm">Directions</CardTitle>
        <CardDescription className="text-xs">
          {DIRECTION_REFERENCE_DESCRIPTIONS[profile]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Directional Reference
          </h4>
          <ul
            className="mx-auto grid max-w-sm grid-cols-3 gap-2"
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
        <div className="space-y-2 border-t border-border pt-4">
          <h4 className="text-xs font-medium text-muted-foreground">
            Parsing Rules
          </h4>
          <GuideGrid entries={entries} />
        </div>
      </CardContent>
    </Card>
  );
}

function GuideCard({
  title,
  entries,
}: {
  title: string;
  entries: GuideEntry[];
}) {
  return (
    <Card className="gap-3 py-4 shadow-none">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <GuideGrid entries={entries} />
      </CardContent>
    </Card>
  );
}

function GuideGrid({ entries }: { entries: GuideEntry[] }) {
  return (
    <dl className="divide-y divide-border/60">
      {entries.map((entry) => (
        <div
          key={`${entry.notation}-${entry.meaning}`}
          className="space-y-0.5 py-2 first:pt-0 last:pb-0"
        >
          <dt>
            <code className="font-mono font-semibold text-primary">
              {entry.notation}
            </code>
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
    { label: 'Dragon Punch', motion: '623' },
  ];

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
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
      <fieldset className="mt-3 flex flex-wrap items-end gap-4">
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
    <div className="flex flex-col items-center gap-1">
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
    <div className="min-w-0 rounded-md border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
