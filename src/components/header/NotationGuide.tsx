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
  getNotationProfileDefinition,
  NOTATION_PROFILES,
  resolveNotationProfile,
} from '@/lib/notationProfiles';
import { parseComboNotation } from '@/lib/parser';
import type { Game, NotationProfile } from '@/lib/types';

interface GuideEntry {
  notation: string;
  meaning: string;
}

interface ProfileGuideContent {
  directionRules: GuideEntry[];
  separators: GuideEntry[];
  mechanics: GuideEntry[];
  examples: GuideEntry[];
}

interface DirectionReferenceEntry {
  notation: string;
  symbol: string;
  meaning: string;
}

const COMMON_SYNTAX: GuideEntry[] = [
  { notation: '+', meaning: 'Press inputs simultaneously' },
  { notation: '|> or (Land)', meaning: 'Land before continuing' },
  {
    notation: 'XxN / (sequence)xN',
    meaning: 'Repeat an input or grouped sequence N times',
  },
  { notation: '(N)', meaning: 'Hit N of a move or a required hit count' },
  { notation: 'CH', meaning: 'Counter hit' },
  { notation: '(whiff)', meaning: 'The move must miss intentionally' },
];

const PROFILE_INPUT_SYNTAX: Record<NotationProfile, GuideEntry[]> = {
  standard: [
    { notation: '[X]', meaning: 'Hold or charge input X' },
    { notation: ']X[', meaning: 'Release input X' },
  ],
  nrs: [],
  tekken: [],
};

const PROFILE_GUIDES: Record<NotationProfile, ProfileGuideContent> = {
  standard: {
    directionRules: [
      { notation: '1–9', meaning: 'Numpad directions; 5 is neutral' },
      { notation: '236 / qcf', meaning: 'Quarter circle forward' },
      { notation: '214 / qcb', meaning: 'Quarter circle back' },
      { notation: '623 / dp', meaning: 'Dragon punch motion' },
      { notation: '421 / rdp', meaning: 'Reverse dragon punch motion' },
      { notation: '41236 / hcf', meaning: 'Half circle forward' },
      { notation: '63214 / hcb', meaning: 'Half circle back' },
      {
        notation: '236236 / 2qcf',
        meaning: 'Double quarter circle forward',
      },
      {
        notation: '214214 / 2qcb',
        meaning: 'Double quarter circle back',
      },
      {
        notation: '360 / spd',
        meaning: 'Full circle motion',
      },
      {
        notation: '720 / 1080',
        meaning: 'Double or triple circle motion',
      },
      {
        notation: '22 / 66 / 44 / 88',
        meaning: 'Down, forward, back, or up twice',
      },
      {
        notation: 'dd / ff / bb / uu',
        meaning: 'Traditional aliases for repeated directions',
      },
      {
        notation: 'hcbf',
        meaning: 'Half circle back, then forward',
      },
    ],
    separators: [
      { notation: '> / → / »', meaning: 'Proceed to the next move' },
      { notation: ',', meaning: 'Link or continue into the next move' },
      { notation: 'xx', meaning: 'Cancel into a special move' },
      { notation: '~', meaning: 'Cancel into a follow-up' },
    ],
    mechanics: [
      { notation: 'jc. / sjc.', meaning: 'Jump cancel / super jump cancel' },
      { notation: 'dl.', meaning: 'Delay the following move' },
      {
        notation: 'j. / sj. / dj. / nj.',
        meaning: 'Jump, super jump, double jump, or neutral jump',
      },
      {
        notation: 'cr. / st. / cl. / f.',
        meaning: 'Crouching, standing, close, or far position',
      },
      { notation: 'iad', meaning: 'Instant air dash' },
      { notation: 'tk.', meaning: 'Tiger-knee input or setup' },
    ],
    examples: [
      {
        notation: '2L > 5M > 5H xx 236H',
        meaning: 'Simple: light-to-heavy route into a special cancel',
      },
      {
        notation: 'j.H > 5M > 2M xx qcb.H',
        meaning: 'Intermediate: jump-in route using a traditional motion alias',
      },
      {
        notation: 'CH 5H > 66 > 2M xx 236236H',
        meaning: 'Advanced: counter-hit conversion, dash, and super cancel',
      },
    ],
  },
  nrs: {
    directionRules: [
      { notation: 'F / B / U / D', meaning: 'Forward, Back, Up, and Down' },
      {
        notation: 'U/F / U/B / D/F / D/B',
        meaning: 'Slash diagonals are one directional input',
      },
      {
        notation: 'DF1',
        meaning: 'Down, then Forward, then button 1—not a diagonal',
      },
      {
        notation: 'Upper/lowercase',
        meaning: 'Direction capitalization does not change the input',
      },
      {
        notation: '114',
        meaning: 'Buttons 1, 1, and 4 as a sequential dial string',
      },
    ],
    separators: [
      { notation: '> / → / »', meaning: 'Proceed to the next move' },
      { notation: 'xx', meaning: 'Cancel into a special move' },
      { notation: '~', meaning: 'Cancel or quickly follow with another input' },
      { notation: ',', meaning: 'Continue the combo sequence' },
    ],
    mechanics: [
      {
        notation: 'TH / BL / FL / S / K',
        meaning: 'Throw, Block, Flip or Stance Switch, and Kameo inputs',
      },
      {
        notation: 'FB / EX / DELAY / (DELAY)',
        meaning: 'Fatal Blow, Enhanced move, or delayed input',
      },
      {
        notation: '(hold) / (swap side)',
        meaning: 'Hold the preceding input / switch sides',
      },
      {
        notation: 'J / JF / JB / AIR / (AIR)',
        meaning: 'Neutral, forward, or backward jump / airborne input',
      },
      {
        notation: 'Block / Grab / Throw',
        meaning: 'Named defensive or throw inputs',
      },
      { notation: 'DASH / BACK DASH', meaning: 'Forward or backward dash' },
      { notation: 'EN / AMP', meaning: 'Enhanced or amplified move aliases' },
      {
        notation: 'KB / FB / PB',
        meaning: 'Krushing, Fatal, or Flawless Block',
      },
      { notation: 'NJP / NJK', meaning: 'Neutral Jump Punch / Kick' },
      { notation: 'JIP / JIK', meaning: 'Jump-in Punch / Kick' },
      { notation: 'RUN / RC', meaning: 'Run / Run Cancel' },
      { notation: 'SH / MD', meaning: 'Short Hop / Micro Duck' },
      { notation: 'MB', meaning: 'Injustice Meter Burn' },
      { notation: 'JI', meaning: 'Injustice Jump-In' },
      {
        notation: 'Trait / Interactable',
        meaning: 'Character Power / stage interaction',
      },
    ],
    examples: [
      {
        notation: '1 4 1 D B 2 B (hold)',
        meaning: 'Simple: short Kenshi route ending with a held Back input',
      },
      {
        notation: 'F 3 (hold), B 3 1 K, JF 2, 2 1, D F 2',
        meaning: 'Intermediate: held attack, Kameo extension, and jump-forward',
      },
      {
        notation: 'D B 4 EX, B (hold) K, (swap side), F 4, F 2 1 1 D B 4',
        meaning: 'Advanced: enhanced launcher, held Kameo, and side switch',
      },
    ],
  },
  tekken: {
    directionRules: [
      {
        notation: 'f / d/f / d / d/b / b / u/b / u / u/f',
        meaning: 'Tap directional inputs',
      },
      {
        notation: 'F / D/F / D / D/B / B / U/B / U / U/F',
        meaning: 'Hold directional inputs',
      },
      { notation: 'df / db / uf / ub', meaning: 'Compact diagonals also work' },
      {
        notation: 'DF / DB / UF / UB',
        meaning: 'Compact held diagonals also work',
      },
      { notation: 'N', meaning: 'Return to neutral; visible in icon mode' },
      {
        notation: 'dp',
        meaning: 'Dragon Punch: forward, neutral, down, down-forward',
      },
      {
        notation: 'ff / fff / bb / dash',
        meaning: 'Forward or back dash inputs',
      },
    ],
    separators: [
      {
        notation: '► / > / → / »',
        meaning: 'Tekken 8-style move boundary; commas stay within moves',
      },
      {
        notation: ',',
        meaning: 'Tekken 7-style move boundary when no ► is present',
      },
      { notation: '*', meaning: 'Hold the preceding button' },
      {
        notation: '*(max)',
        meaning: 'Hold the preceding button to maximum level',
      },
      { notation: '<', meaning: 'Delayed input' },
      { notation: ':', meaning: 'Just-frame input' },
      { notation: '~', meaning: 'Immediate or slide input' },
      { notation: '(...)', meaning: 'Required omitted input' },
      { notation: '(Switch)', meaning: 'Switch sides during the combo' },
      { notation: '_ / =', meaning: 'Alternative input / next in sequence' },
    ],
    mechanics: [
      {
        notation: 'WS / FC / BT / WR',
        meaning: 'While Standing / Full Crouch / Back Turned / While Running',
      },
      {
        notation: 'SS / SSL / SSR',
        meaning: 'Sidestep / Sidestep Left / Right',
      },
      { notation: 'SWL / SWR', meaning: 'Sidewalk Left / Right' },
      { notation: 'iWS / iWR', meaning: 'Instant While Standing / Running' },
      {
        notation: 'cc / cd / LP / AIR / any',
        meaning:
          'Crouch cancel / Crouch dash / Low parry / Airborne / Any button',
      },
      { notation: 'H. / R.', meaning: 'Heat / Rage state prefix' },
      {
        notation: 'During Heat / Heat Burst / Heat Smash / Rage Art',
        meaning: 'Tekken 8 Heat and Rage states or actions',
      },
      {
        notation: 'W! / WB! / WBl! / WBo!',
        meaning: 'Wall splat / break / blast / bounce',
      },
      {
        notation: 'F! / FBl! / BB! / S!',
        meaning: 'Floor break / floor blast / balcony break / Tekken 7 screw',
      },
      {
        notation: 'WGF / TGF / EWGF / OTGF / ETGF',
        meaning: 'Standard God Fist move abbreviations',
      },
      {
        notation: 'FD/FT / FD/FA / FU/FT / FU/FA',
        meaning: 'Grounded position and facing',
      },
      {
        notation: '{1+2}',
        meaning: 'Throw-escape input',
      },
    ],
    examples: [
      {
        notation: 'WS,1,3 ► Negativa,3+4 ► f,3,4',
        meaning: 'Simple: while-standing launcher into stance follow-ups',
      },
      {
        notation: 'd,d/f,f,4 ► Hitman,2 ► WS,2,4 ► Heat Burst ► f,F,3',
        meaning: 'Intermediate: motion input, stance, Heat, and held Forward',
      },
      {
        notation: 'FC,d/f,2 ► f,F,1 ► d/f,4,3 ► 1 ► b,3 ► f,f,F,2+4',
        meaning: 'Advanced: full crouch route with held Forward inputs',
      },
    ],
  },
};

const DIRECTION_REFERENCES: Record<NotationProfile, DirectionReferenceEntry[]> =
  {
    standard: [
      { notation: '7', symbol: '↖', meaning: 'Up-back' },
      { notation: '8', symbol: '↑', meaning: 'Up' },
      { notation: '9', symbol: '↗', meaning: 'Up-forward' },
      { notation: '4', symbol: '←', meaning: 'Back' },
      { notation: '5', symbol: '⊙', meaning: 'Neutral' },
      { notation: '6', symbol: '→', meaning: 'Forward' },
      { notation: '1', symbol: '↙', meaning: 'Down-back' },
      { notation: '2', symbol: '↓', meaning: 'Down' },
      { notation: '3', symbol: '↘', meaning: 'Down-forward' },
    ],
    nrs: [
      { notation: 'u/b', symbol: '↖', meaning: 'Up-back' },
      { notation: 'u', symbol: '↑', meaning: 'Up' },
      { notation: 'u/f', symbol: '↗', meaning: 'Up-forward' },
      { notation: 'b', symbol: '←', meaning: 'Back' },
      { notation: '—', symbol: '⊙', meaning: 'Neutral' },
      { notation: 'f', symbol: '→', meaning: 'Forward' },
      { notation: 'd/b', symbol: '↙', meaning: 'Down-back' },
      { notation: 'd', symbol: '↓', meaning: 'Down' },
      { notation: 'd/f', symbol: '↘', meaning: 'Down-forward' },
    ],
    tekken: [
      { notation: 'u/b', symbol: '↖', meaning: 'Up-back' },
      { notation: 'u', symbol: '↑', meaning: 'Up' },
      { notation: 'u/f', symbol: '↗', meaning: 'Up-forward' },
      { notation: 'b', symbol: '←', meaning: 'Back' },
      { notation: 'N', symbol: '★', meaning: 'Neutral' },
      { notation: 'f', symbol: '→', meaning: 'Forward' },
      { notation: 'd/b', symbol: '↙', meaning: 'Down-back' },
      { notation: 'd', symbol: '↓', meaning: 'Down' },
      { notation: 'd/f', symbol: '↘', meaning: 'Down-forward' },
    ],
  };

const DIRECTION_REFERENCE_DESCRIPTIONS: Record<NotationProfile, string> = {
  standard: 'Numpad values map to the direction they represent.',
  nrs: 'Cardinal directions use letters; combine them with / for diagonals.',
  tekken: 'Tap notation is shown. Capitalize a direction to hold it.',
};

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
  const initialProfile = resolveNotationProfile(activeGame);
  const [profile, setProfile] = useState<NotationProfile>(initialProfile);
  const [previewNotation, setPreviewNotation] = useState(
    getNotationProfileDefinition(initialProfile).example,
  );
  const previewInputId = useId();

  useEffect(() => {
    if (!open) return;
    const nextProfile = resolveNotationProfile(activeGame);
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
