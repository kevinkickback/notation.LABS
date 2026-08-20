import type { NotationProfile } from '@/lib/types';

export interface GuideEntry {
  notation: string;
  meaning: string;
}

export interface ProfileGuideContent {
  directionRules: GuideEntry[];
  separators: GuideEntry[];
  mechanics: GuideEntry[];
  examples: GuideEntry[];
}

export interface DirectionReferenceEntry {
  notation: string;
  symbol: string;
  meaning: string;
}

export const COMMON_SYNTAX: GuideEntry[] = [
  { notation: '+', meaning: 'Press inputs simultaneously' },
  { notation: '|> or (Land)', meaning: 'Land before continuing' },
  {
    notation: 'XxN / (sequence)xN',
    meaning: 'Repeat an input or grouped sequence N times',
  },
  {
    notation: 'A or B / (A or B)',
    meaning: 'Alternative inputs; parentheses group the alternatives',
  },
  { notation: '(N)', meaning: 'Hit N of a move or a required hit count' },
  { notation: 'CH', meaning: 'Counter hit' },
  { notation: '(whiff)', meaning: 'The move must miss intentionally' },
];

export const PROFILE_INPUT_SYNTAX: Record<NotationProfile, GuideEntry[]> = {
  standard: [
    { notation: '[X]', meaning: 'Hold or charge input X' },
    { notation: ']X[', meaning: 'Release input X' },
  ],
  nrs: [],
  tekken: [],
};

export const PROFILE_GUIDES: Record<NotationProfile, ProfileGuideContent> = {
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
      { notation: '/\\', meaning: 'Homing jump or launch-follow-up jump' },
      { notation: ',', meaning: 'Link or continue into the next move' },
      { notation: 'xx', meaning: 'Cancel into a special move' },
      { notation: '~', meaning: 'Cancel into a follow-up' },
    ],
    mechanics: [
      { notation: 'jc. / sjc.', meaning: 'Jump cancel / super jump cancel' },
      {
        notation: 'hjc.',
        meaning: 'High jump cancel; commonly synonymous with super jump cancel',
      },
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
      { notation: 'OTG / FC', meaning: 'Off the ground / Fatal Counter' },
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
      {
        notation: ',',
        meaning: 'Community-standard boundary between following moves',
      },
      {
        notation: '> / → / »',
        meaning: 'Accepted aliases for moving to the next move',
      },
      { notation: 'xx', meaning: 'Cancel into a special move' },
      { notation: '~', meaning: 'Cancel or quickly follow with another input' },
    ],
    mechanics: [
      {
        notation: 'TH / BL / FL / S / K',
        meaning: 'Throw, Block, Flip or Stance Switch, and Kameo inputs',
      },
      {
        notation: 'FP / BP / FK / BK',
        meaning: 'Classic named punch and kick aliases for buttons 1–4',
      },
      {
        notation: 'FS / SS / KM',
        meaning: 'Flip Stance / Stance Switch / Kameo aliases',
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
        notation: '►',
        meaning:
          'Community-standard Tekken 8 move boundary; commas stay within moves',
      },
      {
        notation: '> / → / »',
        meaning: 'Accepted aliases for the Tekken 8 move boundary',
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
      { notation: '#', meaning: 'Inputs pressed together on the same frame' },
      { notation: '.', meaning: 'Input performed from the preceding stance' },
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
        notation: 'hFC / SW',
        meaning: 'Half Crouch / Sidewalk',
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
        notation: 'B! / S! / T!',
        meaning: 'Bound / Tekken 7 screw / Tekken 8 Tornado',
      },
      {
        notation: 'F! / FB! / FBl! / BB!',
        meaning: 'Floor break aliases / floor blast / balcony break',
      },
      {
        notation: 'CL / OTG / JG / KND',
        meaning: 'Clean hit / grounded opponent / juggle starter / knockdown',
      },
      {
        notation: 'P / J / H / R',
        meaning: 'Parry / jumping / Heat / Rage state markers',
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
        notation: 'FDFT / FDFA / FUFT / FUFA',
        meaning: 'Compact grounded position and facing aliases',
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

export const DIRECTION_REFERENCES: Record<
  NotationProfile,
  DirectionReferenceEntry[]
> = {
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

export const DIRECTION_REFERENCE_DESCRIPTIONS: Record<NotationProfile, string> =
  {
    standard: 'Numpad values map to the direction they represent.',
    nrs: 'Cardinal directions use letters; combine them with / for diagonals.',
    tekken: 'Tap notation is shown. Capitalize a direction to hold it.',
  };

/** Parser fixtures covering every syntax form advertised by the guide. */
export const GUIDE_PARSER_SAMPLES: {
  common: string[];
  profiles: Record<NotationProfile, string[]>;
} = {
  common: [
    '1+2',
    '1 > 2',
    '1 → 2',
    '1 » 2',
    '1 |> 2',
    '1 (Land) 2',
    '1x3',
    '(1 > 2)x3',
    '1 or 2',
    '(1 or 2)',
    '(3)',
    'CH',
    '(whiff)',
  ],
  profiles: {
    standard: [
      '1 2 3 4 5 6 7 8 9',
      '236 qcf 214 qcb 623 dp 421 rdp 41236 hcf 63214 hcb',
      '236236 2qcf 214214 2qcb 360 spd 720 1080',
      '22 66 44 88 dd ff bb uu hcbf',
      '[L] ]L[',
      'L,M L xx M L~M',
      'L /\\ M',
      'jc. sjc. hjc. dl. j. sj. dj. nj. cr. st. cl. f. iad tk. OTG FC',
    ],
    nrs: [
      'F B U D U/F U/B D/F D/B DF1 df1 114',
      '1 xx 2 1~2 1,2',
      'TH BL FL S K FB EX DELAY (DELAY)',
      'FP BP FK BK FS KM SS',
      '(hold) (swap side) J JF JB AIR (AIR)',
      'Block Grab Throw DASH BACK DASH EN AMP KB PB',
      'NJP NJK JIP JIK RUN RC SH MD MB JI Trait Interactable',
    ],
    tekken: [
      'f d/f d d/b b u/b u u/f F D/F D D/B B U/B U U/F',
      'df db uf ub DF DB UF UB N dp ff fff bb dash',
      '1 ► 2 1 > 2 1 → 2 1 » 2 1,3 1* 2*(max) f<1 1:2 1#2 1~2',
      '(...) (Switch) 1_2 1=2',
      'WS FC hFC BT WR SS SSL SSR SW SWL SWR iWS iWR',
      'cc cd LP AIR any H. R.',
      'During Heat Heat Burst Heat Smash Rage Art',
      'B! S! T! W! WB! WBl! WBo! F! FB! FBl! BB!',
      'CL OTG JG KND P J H R',
      'WGF TGF EWGF OTGF ETGF',
      'FD/FT FD/FA FU/FT FU/FA FDFT.1 FDFA.2 FUFT.3 FUFA.4 {1+2}',
    ],
  },
};
