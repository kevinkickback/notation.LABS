import type { Game, NotationProfile } from './types';

export interface NotationProfileDefinition {
  id: NotationProfile;
  label: string;
  shortLabel: string;
  description: string;
  example: string;
  defaultButtons: string[];
}

export const NRS_MECHANIC_LABELS: Readonly<Record<string, string>> = {
  '(hold)': 'Hold the preceding input',
  '(swap side)': 'Switch sides during the combo',
  AMP: 'Amplified move',
  AIR: 'Airborne input',
  'BACK DASH': 'Back dash',
  Block: 'Block',
  DELAY: 'Delayed input',
  DASH: 'Forward dash',
  EN: 'Enhanced move',
  EX: 'Enhanced move',
  FB: 'Fatal Blow',
  Grab: 'Grab',
  J: 'Neutral jump',
  JB: 'Jump backward',
  JF: 'Jump forward',
  JI: 'Jump-in attack',
  JIK: 'Jump-in kick',
  JIP: 'Jump-in punch',
  KB: 'Krushing Blow',
  MB: 'Meter Burn',
  MD: 'Micro duck',
  NJK: 'Neutral jump kick',
  NJP: 'Neutral jump punch',
  PB: 'Flawless Block',
  RC: 'Run cancel',
  RUN: 'Run',
  SH: 'Short hop',
  Throw: 'Throw',
  Interactable: 'Stage interaction',
  Trait: 'Character power',
};

export const TEKKEN_MECHANIC_LABELS: Readonly<Record<string, string>> = {
  '*': 'Hold the preceding button',
  '*(max)': 'Hold the preceding button to maximum level',
  '(...)': 'Required omitted input',
  '(Switch)': 'Side switch',
  AIR: 'Airborne state',
  any: 'Any attack button',
  iWS: 'Instant While Standing',
  iWR: 'Instant While Running',
  cc: 'Crouch cancel',
  cd: 'Crouch dash',
  LP: 'Low parry',
  WGF: 'Wind God Fist',
  TGF: 'Thunder God Fist',
  EWGF: 'Electric Wind God Fist',
  OTGF: 'Omen Thunder God Fist',
  ETGF: 'Electric Thunder God Fist',
  'W!': 'Wall splat',
  'WB!': 'Wall break',
  'WBl!': 'Wall blast',
  'WBo!': 'Wall bounce',
  'F!': 'Floor break',
  'FBl!': 'Floor blast',
  'BB!': 'Balcony break',
  'S!': 'Screw attack',
  'During Heat': 'During Heat state',
  'Heat Burst': 'Heat Burst',
  'Heat Smash': 'Heat Smash',
  'Rage Art': 'Rage Art',
};

export const NOTATION_PROFILES: NotationProfileDefinition[] = [
  {
    id: 'standard',
    label: 'Standard / Numpad',
    shortLabel: 'Standard',
    description:
      'Numbers are directions. Supports numpad motions and traditional aliases such as qcf and dp.',
    example: '2L > 5M > 5H xx 236H',
    defaultButtons: ['L', 'M', 'H', 'S'],
  },
  {
    id: 'nrs',
    label: 'NRS',
    shortLabel: 'NRS',
    description:
      'For Mortal Kombat, Injustice, and similar games. Numbers are attack buttons; directions use letters.',
    example: '1 4 1 D B 2 B (hold)',
    defaultButtons: ['1', '2', '3', '4'],
  },
  {
    id: 'tekken',
    label: 'Tekken',
    shortLabel: 'Tekken',
    description:
      'Numbers are attack buttons. Lowercase directions are taps and uppercase directions are holds.',
    example: 'WS,1,3 ► Negativa,3+4 ► f,3,4',
    defaultButtons: ['1', '2', '3', '4'],
  },
];

const BUTTON_MEANINGS: Record<
  Exclude<NotationProfile, 'standard'>,
  Record<string, string>
> = {
  nrs: {
    '1': 'Attack 1',
    '2': 'Attack 2',
    '3': 'Attack 3',
    '4': 'Attack 4',
    K: 'Kameo Input',
    S: 'Stance Switch',
    BLOCK: 'Block',
    GRAB: 'Grab',
    THROW: 'Throw',
    TH: 'Throw',
    BL: 'Block',
    FL: 'Flip Stance',
  },
  tekken: {
    '1': 'Left Punch',
    '2': 'Right Punch',
    '3': 'Left Kick',
    '4': 'Right Kick',
  },
};

export function resolveNotationProfile(
  game?: Pick<Game, 'notationProfile' | 'inputType'> | null,
): NotationProfile {
  if (game?.notationProfile) {
    return game.notationProfile;
  }
  return game?.inputType === 'button-numbers' ? 'tekken' : 'standard';
}

export function getNotationProfileDefinition(
  profile: NotationProfile,
): NotationProfileDefinition {
  return (
    NOTATION_PROFILES.find((definition) => definition.id === profile) ??
    NOTATION_PROFILES[0]
  );
}

export function getButtonAccessibilityLabel(
  profile: NotationProfile,
  button: string,
): string {
  const normalizedButton = button.toUpperCase();
  const meaning =
    profile === 'standard'
      ? undefined
      : BUTTON_MEANINGS[profile][normalizedButton];
  return meaning ? `Button ${button}, ${meaning}` : `Button ${button}`;
}

export function getMechanicAccessibilityLabel(
  profile: NotationProfile,
  value: string,
): string {
  const normalizedValue = value.trim();
  const meaning =
    profile === 'nrs'
      ? NRS_MECHANIC_LABELS[normalizedValue]
      : profile === 'tekken'
        ? TEKKEN_MECHANIC_LABELS[normalizedValue]
        : undefined;
  return meaning
    ? `${normalizedValue}, ${meaning}`
    : `${normalizedValue} mechanic`;
}

export function migrateLegacyNotationProfile(game: Game): void {
  game.notationProfile = resolveNotationProfile(game);
  delete game.inputType;
}

export function normalizeGameNotationProfile(game: Game): Game {
  const { inputType: _legacyInputType, ...currentGame } = game;
  return {
    ...currentGame,
    notationProfile: resolveNotationProfile(game),
  };
}
