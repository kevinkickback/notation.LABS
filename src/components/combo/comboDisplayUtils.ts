import {
  NRS_MECHANIC_LABELS,
  TEKKEN_MECHANIC_LABELS,
} from '@/lib/notationProfiles';
import type { ComboToken, NotationColors, NotationProfile } from '@/lib/types';

export const REPEAT_PAREN_COLOR = 'oklch(0.65 0.02 265)';
export const TEKKEN_EXPLICIT_MOVE_BOUNDARIES = new Set(['►', '>', '→', '»']);

export function getTokenColor(
  token: ComboToken,
  colors: Record<string, string>,
  buttonColors?: Record<string, string>,
): string {
  switch (token.type) {
    case 'direction':
    case 'motion':
      return colors.direction || '#bdceef';
    case 'button':
      return buttonColors?.[token.value] ?? colors.direction ?? '#bdceef';
    case 'modifier': {
      if (token.value === 'CH') {
        return colors.separator || '#6c727e';
      }
      if (token.value.startsWith('(') || token.value === ')') {
        return colors.separator || '#6c727e';
      }
      if (token.value.startsWith('[') || token.value.startsWith(']')) {
        const delimitedButtonMatch = token.value
          .trim()
          .match(/^(?:\[([^[\]]+)\]|\]([^[\]]+)\[)$/);
        const delimitedButton = (
          delimitedButtonMatch?.[1] ?? delimitedButtonMatch?.[2]
        )
          ?.trim()
          .toUpperCase();
        return (
          (delimitedButton ? buttonColors?.[delimitedButton] : undefined) ??
          colors.separator ??
          '#6c727e'
        );
      }
      return colors.direction || '#bdceef';
    }
    case 'separator':
      return colors.separator || '#6c727e';
    default:
      return colors.direction || '#bdceef';
  }
}

export const DIRECTION_MODIFIERS: Record<string, string> = {
  'st.': '5',
  'cr.': '2',
  'b.': '4',
  'db.': '1',
  'df.': '3',
  'f.': '6',
  'ub.': '7',
  'u.': '8',
  'uf.': '9',
  dash: '66',
};

// Maps letter-based profile directions to numpad equivalents for icon display.
export const LETTER_DIR_TO_NUMPAD: Record<string, string> = {
  n: '5',
  f: '6',
  b: '4',
  u: '8',
  d: '2',
  'd/f': '3',
  'd/b': '1',
  'u/f': '9',
  'u/b': '7',
  df: '3',
  db: '1',
  uf: '9',
  ub: '7',
};

export const DIRECTION_NAMES: Record<string, string> = {
  '1': 'Down Back',
  '2': 'Down',
  '3': 'Down Forward',
  '4': 'Back',
  '6': 'Forward',
  '7': 'Up Back',
  '8': 'Up',
  '9': 'Up Forward',
  n: 'Neutral',
  f: 'Forward',
  b: 'Back',
  u: 'Up',
  d: 'Down',
  'd/f': 'Down Forward',
  'd/b': 'Down Back',
  'u/f': 'Up Forward',
  'u/b': 'Up Back',
  df: 'Down Forward',
  db: 'Down Back',
  uf: 'Up Forward',
  ub: 'Up Back',
};

const COMMON_LABELED_MECHANICS = new Set([
  '(whiff)',
  'cl.',
  'dj.',
  'dl.',
  'iad',
  'hjc.',
  'j.',
  'jc.',
  'nj.',
  'sj.',
  'sjc.',
  'tk.',
  'OTG',
  'FC',
]);

const PROFILE_LABELED_MECHANICS: Record<
  NotationProfile,
  ReadonlySet<string>
> = {
  standard: new Set(),
  nrs: new Set(Object.keys(NRS_MECHANIC_LABELS)),
  tekken: new Set([
    ...Object.keys(TEKKEN_MECHANIC_LABELS),
    'BT',
    'FC',
    'FD/FA',
    'FD/FT',
    'FU/FA',
    'FU/FT',
    'H.',
    'R.',
    'SS',
    'SSL',
    'SSR',
    'SWL',
    'SWR',
    'W!',
    'WB!',
    'WR',
    'WS',
  ]),
};

export function shouldRenderMechanicBadge(
  profile: NotationProfile,
  value: string,
): boolean {
  const normalizedValue = value.trim();
  return (
    COMMON_LABELED_MECHANICS.has(normalizedValue) ||
    PROFILE_LABELED_MECHANICS[profile].has(normalizedValue)
  );
}

export function isLiteralParenUnknown(token: ComboToken): boolean {
  return (
    token.type === 'unknown' && (token.value === '(' || token.value === ')')
  );
}

export function isStructuralGroupingParen(token: ComboToken): boolean {
  return (
    token.type === 'modifier' && (token.value === '(' || token.value === ')')
  );
}

export function getNrsHoldAssociations(tokens: ComboToken[]): {
  heldInputIndices: ReadonlySet<number>;
  appliedAnnotationIndices: ReadonlySet<number>;
} {
  const heldInputIndices = new Set<number>();
  const appliedAnnotationIndices = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'modifier' || tokens[i].value !== '(hold)') {
      continue;
    }

    for (let previousIndex = i - 1; previousIndex >= 0; previousIndex--) {
      const previousToken = tokens[previousIndex];
      if (previousToken.type === 'separator') break;
      if (
        previousToken.type === 'direction' ||
        previousToken.type === 'button'
      ) {
        heldInputIndices.add(previousIndex);
        appliedAnnotationIndices.add(i);
        break;
      }
    }
  }

  return { heldInputIndices, appliedAnnotationIndices };
}

export function getRepeatParenIndices(tokens: ComboToken[]): Set<number> {
  const showParens = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'repeat-start') {
      let innerCount = 0;
      let endIdx = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'repeat-end') {
          endIdx = j;
          break;
        }
        if (tokens[j].type !== 'separator') {
          innerCount++;
        }
      }
      if (innerCount > 1 && endIdx !== -1) {
        showParens.add(i);
        showParens.add(endIdx);
      }
    }
  }
  return showParens;
}

export function groupTokensWithButtons(
  tokens: ComboToken[],
  colors: NotationColors,
  buttonColors?: Record<string, string>,
): Array<{ tokens: ComboToken[]; buttonColor?: string }> {
  const groups: Array<{ tokens: ComboToken[]; buttonColor?: string }> = [];
  let currentGroup: ComboToken[] = [];
  let pendingButton: ComboToken | null = null;

  for (const token of tokens) {
    if (token.type === 'separator') {
      if (pendingButton) {
        const buttonColor = getTokenColor(pendingButton, colors, buttonColors);
        groups.push({ tokens: currentGroup, buttonColor });
        currentGroup = [];
        pendingButton = null;
      } else if (currentGroup.length > 0) {
        groups.push({ tokens: currentGroup });
        currentGroup = [];
      }
      groups.push({ tokens: [token] });
    } else if (isLiteralParenUnknown(token)) {
      if (pendingButton) {
        const buttonColor = getTokenColor(pendingButton, colors, buttonColors);
        groups.push({ tokens: currentGroup, buttonColor });
        currentGroup = [];
        pendingButton = null;
      } else if (currentGroup.length > 0) {
        groups.push({ tokens: currentGroup });
        currentGroup = [];
      }
      groups.push({ tokens: [token] });
    } else if (token.type === 'button') {
      pendingButton = token;
      currentGroup.push(token);
    } else if (token.type === 'modifier') {
      const delimitedButton = getDelimitedButton(token.value);
      if (
        delimitedButton &&
        buttonColors?.[delimitedButton.button.toUpperCase()]
      ) {
        pendingButton = {
          type: 'button',
          value: delimitedButton.button.toUpperCase(),
          rawValue: token.rawValue,
        };
      }
      currentGroup.push(token);
    } else {
      currentGroup.push(token);
    }
  }

  if (currentGroup.length > 0) {
    if (pendingButton) {
      const buttonColor = getTokenColor(pendingButton, colors, buttonColors);
      groups.push({ tokens: currentGroup, buttonColor });
    } else {
      groups.push({ tokens: currentGroup });
    }
  }

  return groups;
}

export function getDelimitedButton(tokenValue: string): {
  button: string;
  kind: 'hold' | 'release';
  leadingDelimiter: '[' | ']';
  trailingDelimiter: '[' | ']';
} | null {
  const trimmed = tokenValue.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const button = trimmed.slice(1, -1).trim();
    if (!button) return null;
    return {
      button,
      kind: 'hold',
      leadingDelimiter: '[',
      trailingDelimiter: ']',
    };
  }
  if (trimmed.startsWith(']') && trimmed.endsWith('[')) {
    const button = trimmed.slice(1, -1).trim();
    if (!button) return null;
    return {
      button,
      kind: 'release',
      leadingDelimiter: ']',
      trailingDelimiter: '[',
    };
  }
  return null;
}

export function isDescriptiveBracketAnnotation(token: ComboToken): boolean {
  if (token.type !== 'modifier') {
    return false;
  }
  const delimitedButton = getDelimitedButton(token.value);
  if (delimitedButton === null) {
    return false;
  }
  // Treat bracket labels with spaces as descriptive annotations, not button inputs.
  return delimitedButton.button.includes(' ');
}
