import type { ComboToken } from './types';

// Bump when parser behavior changes and stored combo tokens need refreshing.
export const COMBO_NOTATION_PARSER_VERSION = 2;

// Ordered from longest to shortest semantic motions so numeric tokens prefer
// complete motion matches before falling back to individual directions.
const MOTIONS = [
  '236236',
  '214214',
  '236',
  '214',
  '623',
  '421',
  '41236',
  '63214',
  '22',
  '66',
  '44',
  '88',
  '28',
  '82',
  '46',
  '64',
  '426',
  '624',
  '632',
  '360',
  '720',
  '1080',
];

// Human-friendly aliases are normalized before button parsing, which lets
// notations like "dp.HP" resolve as a motion followed by a button.
const MOTION_ALIASES: Record<string, string> = {
  qcf: '236',
  quartercircleforward: '236',
  'quarter circle forward': '236',
  'quarter-circle-forward': '236',
  qcb: '214',
  quartercircleback: '214',
  'quarter circle back': '214',
  'quarter-circle-back': '214',
  dp: '623',
  dragonpunch: '623',
  'dragon punch': '623',
  'dragon-punch': '623',
  srk: '623',
  shoryuken: '623',
  rdp: '421',
  reversedp: '421',
  'reverse dp': '421',
  'reverse dragon punch': '421',
  reversedragonpunch: '421',
  hcf: '41236',
  halfcircleforward: '41236',
  'half circle forward': '41236',
  'half-circle-forward': '41236',
  hcb: '63214',
  halfcircleback: '63214',
  'half circle back': '63214',
  'half-circle-back': '63214',
  '2qcf': '236236',
  'double qcf': '236236',
  doublequartercircleforward: '236236',
  'double quarter circle forward': '236236',
  '2qcb': '214214',
  'double qcb': '214214',
  doublequartercircleback: '214214',
  'double quarter circle back': '214214',
  spd: '360',
  fullcircle: '360',
  'full circle': '360',
  'full-circle': '360',
  '360motion': '360',
  doublecircle: '720',
  'double circle': '720',
  'double-circle': '720',
  '720motion': '720',
  dd: '22',
  downdown: '22',
  'down down': '22',
  'down-down': '22',
  doubledown: '22',
  'double down': '22',
  uu: '88',
  upup: '88',
  'up up': '88',
  'up-up': '88',
  doubleup: '88',
  'double up': '88',
  ff: '66',
  forwardforward: '66',
  'forward forward': '66',
  'forward-forward': '66',
  'dash forward': '66',
  dash: '66',
  bb: '44',
  backback: '44',
  'back back': '44',
  'back-back': '44',
  backdash: '44',
  'back dash': '44',
  'tiger knee': '2369',
  tk: '2369',
  tigerknee: '2369',
  'tiger-knee': '2369',
};

const DIRECTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const COMMON_BUTTONS = [
  'L',
  'M',
  'H',
  'S',
  'LP',
  'MP',
  'HP',
  'LK',
  'MK',
  'HK',
  'P',
  'K',
  'A',
  'B',
  'C',
  'D',
  'X',
  'Y',
];

const STANCE_MODIFIERS: Record<string, string> = {
  standing: 'st.',
  stand: 'st.',
  'st.': 'st.',
  st: 'st.',
  's.': 'st.',
  crouching: 'cr.',
  crouch: 'cr.',
  'cr.': 'cr.',
  cr: 'cr.',
  'c.': 'cr.',
  jumping: 'j.',
  jump: 'j.',
  'j.': 'j.',
  j: 'j.',
  air: 'j.',
  aerial: 'j.',
  superjump: 'sj.',
  'super jump': 'sj.',
  'sj.': 'sj.',
  sj: 'sj.',
  'double jump': 'dj.',
  doublejump: 'dj.',
  'dj.': 'dj.',
  dj: 'dj.',
  'neutral jump': 'nj.',
  neutraljump: 'nj.',
  'nj.': 'nj.',
  nj: 'nj.',
  close: 'cl.',
  'cl.': 'cl.',
  cl: 'cl.',
  far: 'f.',
  'f.': 'f.',
  'b.': 'b.',
  'db.': 'db.',
  'df.': 'df.',
  'ub.': 'ub.',
  'u.': 'u.',
  'uf.': 'uf.',
  'counter hit': 'CH',
  counterhit: 'CH',
  'counter-hit': 'CH',
  ch: 'CH',
};

const SPECIAL_MODIFIERS: Record<string, string> = {
  'tiger knee': 'tk.',
  tigerknee: 'tk.',
  'tiger-knee': 'tk.',
  'tk.': 'tk.',
  tk: 'tk.',
  'instant air dash': 'iad',
  instantairdash: 'iad',
  'instant-air-dash': 'iad',
  iad: 'iad',
  'jump cancel': 'jc.',
  jumpcancel: 'jc.',
  'jump-cancel': 'jc.',
  'jc.': 'jc.',
  jc: 'jc.',
  'super jump cancel': 'sjc.',
  superjumpcancel: 'sjc.',
  'super-jump-cancel': 'sjc.',
  'sjc.': 'sjc.',
  sjc: 'sjc.',
  delay: 'dl.',
  delayed: 'dl.',
  'dl.': 'dl.',
  dl: 'dl.',
  dash: 'dash',
  dashing: 'dash',
  whiff: '(whiff)',
  whiffed: '(whiff)',
  land: '|>',
  charge: '[charge]',
  charging: '[charge]',
  hold: '[hold]',
  holding: '[hold]',
  release: '[release]',
};

const SEPARATORS = [
  '|>',
  '>',
  '→',
  ',',
  '+',
  '~',
  '»',
  'xx',
  'link',
  'linked',
  '/',
];

// Pre-sorted lookup tables keep the parser's hot path allocation-free.
const SORTED_ALL_MODIFIERS = Object.keys({
  ...STANCE_MODIFIERS,
  ...SPECIAL_MODIFIERS,
}).sort((a, b) => b.length - a.length);
const SORTED_ALIASES = Object.keys(MOTION_ALIASES).sort(
  (a, b) => b.length - a.length,
);
const SORTED_MOTIONS = [...MOTIONS].sort((a, b) => b.length - a.length);

/**
 * Parses raw combo notation into displayable tokens.
 */
export function parseComboNotation(
  notation: string,
  customButtons: string[] = [],
): ComboToken[] {
  const tokens: ComboToken[] = [];
  const allButtons =
    customButtons.length > 0 ? [...customButtons] : [...COMMON_BUTTONS];
  const sortedButtons = [...allButtons].sort((a, b) => b.length - a.length);

  const isAsciiLetter = (value: string | undefined): boolean => {
    if (!value) {
      return false;
    }
    return /[a-z]/i.test(value);
  };

  const hasLetterBoundaryForButton = (
    inputText: string,
    start: number,
    buttonLength: number,
    buttonText: string,
  ): boolean => {
    // Only apply boundary checks to plain alphabetic buttons (A, B, C, D, LP, RC, etc.).
    if (!/^[a-z]+$/i.test(buttonText)) {
      return true;
    }

    const prevChar = start > 0 ? inputText[start - 1] : undefined;
    const nextChar = inputText[start + buttonLength];
    return !isAsciiLetter(prevChar) && !isAsciiLetter(nextChar);
  };

  const hasLetterBoundaryForWordToken = (
    inputText: string,
    start: number,
    tokenLength: number,
    tokenText: string,
  ): boolean => {
    if (!/^[a-z]+$/i.test(tokenText)) {
      return true;
    }

    const prevChar = start > 0 ? inputText[start - 1] : undefined;
    const nextChar = inputText[start + tokenLength];
    return !isAsciiLetter(prevChar) && !isAsciiLetter(nextChar);
  };

  const consumeUnknownPhrase = (start: number): string => {
    let end = start;

    while (end < input.length) {
      const char = input[end];

      // Keep single spaces only when they are between letters.
      if (char === ' ') {
        const prevChar = end > start ? input[end - 1] : undefined;
        const nextChar = end + 1 < input.length ? input[end + 1] : undefined;
        if (isAsciiLetter(prevChar) && isAsciiLetter(nextChar)) {
          end++;
          continue;
        }
        break;
      }

      // Stop phrase before notation delimiters and structural symbols.
      if ('()[]{}<>+~,/|'.includes(char)) {
        break;
      }

      // Stop at motion-friendly digits so inputs like 5A keep parsing correctly.
      if (/[0-9]/.test(char)) {
        break;
      }

      // Keep contiguous letters as a single unknown phrase token.
      if (isAsciiLetter(char)) {
        end++;
        continue;
      }

      break;
    }

    return input.substring(start, end);
  };

  const tryInlineRepeat = (pos: number): number => {
    const remaining = input.substring(pos);
    const match = remaining.match(/^[xX*](\d+|N)/i);
    if (match) {
      const repeatValue = match[1];
      const repeatTokenFields = /^\d+$/.test(repeatValue)
        ? { repeatCount: parseInt(repeatValue, 10) }
        : { repeatLabel: repeatValue.toUpperCase() };
      const lastToken = tokens.pop();
      if (lastToken) {
        tokens.push({ type: 'repeat-start', value: '(', rawValue: '(' });
        tokens.push(lastToken);
        tokens.push({
          type: 'repeat-end',
          value: ')',
          rawValue: ')',
          ...repeatTokenFields,
        });
      }
      return match[0].length;
    }
    return 0;
  };

  const findMatchingParen = (startIndex: number): number => {
    let depth = 0;

    for (let index = startIndex; index < input.length; index++) {
      if (input[index] === '(') {
        depth++;
      }

      if (input[index] === ')') {
        depth--;
        if (depth === 0) {
          return index;
        }
      }
    }

    return -1;
  };

  const findMatchingBracket = (startIndex: number): number => {
    let depth = 0;

    for (let index = startIndex; index < input.length; index++) {
      if (input[index] === '[') {
        depth++;
      }

      if (input[index] === ']') {
        depth--;
        if (depth === 0) {
          return index;
        }
      }
    }

    return -1;
  };

  const isNotationLikeParenthetical = (content: string): boolean => {
    const trimmed = content.trim();
    if (!trimmed) {
      return false;
    }

    // Treat grouped expressions as notation if they include common combo syntax.
    return /[0-9><+~,/|.]/.test(trimmed);
  };

  let i = 0;
  const input = notation.trim();

  while (i < input.length) {
    if (input[i] === ' ') {
      i++;
      continue;
    }

    let matched = false;

    if (input[i] === '(') {
      const closeParenIndex = findMatchingParen(i);
      if (closeParenIndex !== -1) {
        const afterParen = input.substring(closeParenIndex + 1).trimStart();
        const repeatMatch = afterParen.match(/^[xX*](\d+|N)/i);

        if (repeatMatch) {
          const repeatValue = repeatMatch[1];
          const repeatTokenFields = /^\d+$/.test(repeatValue)
            ? { repeatCount: parseInt(repeatValue, 10) }
            : { repeatLabel: repeatValue.toUpperCase() };
          const contentStart = i + 1;
          const contentEnd = closeParenIndex;
          const content = input.substring(contentStart, contentEnd);
          const fullMatchLength =
            closeParenIndex -
            i +
            1 +
            repeatMatch[0].length +
            (afterParen.length - afterParen.trimStart().length);

          tokens.push({
            type: 'repeat-start',
            value: '(',
            rawValue: '(',
          });

          const nestedTokens = parseComboNotation(content, customButtons);
          tokens.push(...nestedTokens);

          tokens.push({
            type: 'repeat-end',
            value: ')',
            rawValue: ')',
            ...repeatTokenFields,
          });

          i += fullMatchLength;
          matched = true;
        } else {
          const contentStart = i + 1;
          const contentEnd = closeParenIndex;
          const content = input.substring(contentStart, contentEnd);
          const normalizedParenthetical = content
            .toLowerCase()
            .replace(/\s+/g, '');

          if (isNotationLikeParenthetical(content)) {
            tokens.push({
              type: 'unknown',
              value: '(',
              rawValue: '(',
            });
            const nestedTokens = parseComboNotation(content, customButtons);
            tokens.push(...nestedTokens);
            tokens.push({
              type: 'unknown',
              value: ')',
              rawValue: ')',
            });
            i = closeParenIndex + 1;
          } else if (normalizedParenthetical === 'land') {
            const fullText = input.substring(i, closeParenIndex + 1);
            tokens.push({
              type: 'separator',
              value: '|>',
              rawValue: fullText,
            });
            i = closeParenIndex + 1;
          } else {
            // Keep descriptive parenthetical notes as a single modifier token.
            const fullText = input.substring(i, closeParenIndex + 1);
            tokens.push({
              type: 'modifier',
              value: fullText,
              rawValue: fullText,
            });
            i = closeParenIndex + 1;
          }

          matched = true;
        }
      }
    }
    if (matched) continue;

    if (input[i] === '[') {
      const closeBracketIndex = findMatchingBracket(i);
      if (closeBracketIndex !== -1) {
        let tokenEnd = closeBracketIndex + 1;
        while (tokenEnd < input.length && input[tokenEnd] === ' ') {
          tokenEnd++;
        }
        const fullText = input.substring(i, tokenEnd);
        tokens.push({
          type: 'modifier',
          value: fullText,
          rawValue: fullText,
        });
        i = tokenEnd;
        matched = true;
      }
    }
    if (matched) continue;

    for (const sep of SEPARATORS) {
      const chunk = input.substring(i, i + sep.length);
      if (
        (chunk === sep || (sep === 'xx' && chunk.toLowerCase() === 'xx')) &&
        hasLetterBoundaryForWordToken(input, i, sep.length, sep)
      ) {
        tokens.push({
          type: 'separator',
          value: sep,
          rawValue: chunk,
        });
        i += sep.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const modKey of SORTED_ALL_MODIFIERS) {
      const normalizedInput = input
        .substring(i, i + modKey.length)
        .toLowerCase()
        .replace(/\s+/g, '');
      const normalizedModKey = modKey.toLowerCase().replace(/\s+/g, '');

      if (
        normalizedInput === normalizedModKey &&
        hasLetterBoundaryForWordToken(input, i, modKey.length, modKey)
      ) {
        const normalizedValue =
          STANCE_MODIFIERS[modKey] || SPECIAL_MODIFIERS[modKey];
        tokens.push({
          type: 'modifier',
          value: normalizedValue,
          rawValue: input.substring(i, i + modKey.length),
        });
        i += modKey.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const alias of SORTED_ALIASES) {
      const normalizedInput = input
        .substring(i, i + alias.length)
        .toLowerCase()
        .replace(/\s+/g, '');
      const normalizedAlias = alias.toLowerCase().replace(/\s+/g, '');

      if (
        normalizedInput === normalizedAlias &&
        hasLetterBoundaryForWordToken(input, i, alias.length, alias)
      ) {
        const numpadValue = MOTION_ALIASES[alias];
        let matchLength = alias.length;
        // Auto-consume trailing dot delimiter (e.g. dp.HP → motion "dp." + button "HP")
        if (i + matchLength < input.length && input[i + matchLength] === '.') {
          matchLength++;
        }
        tokens.push({
          type: 'motion',
          value: numpadValue,
          rawValue: input.substring(i, i + matchLength),
        });
        i += matchLength;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const motion of SORTED_MOTIONS) {
      if (input.substring(i, i + motion.length) === motion) {
        tokens.push({
          type: 'motion',
          value: motion,
          rawValue: motion,
        });
        i += motion.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const dir of DIRECTIONS) {
      if (input[i] === dir) {
        tokens.push({
          type: 'direction',
          value: dir,
          rawValue: dir,
        });
        i++;
        i += tryInlineRepeat(i);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const btn of sortedButtons) {
      if (
        input.substring(i, i + btn.length).toUpperCase() ===
          btn.toUpperCase() &&
        hasLetterBoundaryForButton(input, i, btn.length, btn)
      ) {
        tokens.push({
          type: 'button',
          value: btn.toUpperCase(),
          rawValue: input.substring(i, i + btn.length),
        });
        i += btn.length;
        i += tryInlineRepeat(i);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const unknownPhrase = consumeUnknownPhrase(i);
    const unknownChar = unknownPhrase || input[i];
    tokens.push({
      type: 'unknown',
      value: unknownChar,
      rawValue: unknownChar,
    });
    i += unknownChar.length;
  }

  // Collapse consecutive identical buttons into repeat groups (e.g. LLL → L×3)
  const collapsed: ComboToken[] = [];
  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    if (token.type === 'button') {
      let count = 1;
      while (
        t + count < tokens.length &&
        tokens[t + count].type === 'button' &&
        tokens[t + count].value === token.value
      ) {
        count++;
      }
      if (count > 1) {
        collapsed.push({ type: 'repeat-start', value: '(', rawValue: '(' });
        collapsed.push(token);
        collapsed.push({
          type: 'repeat-end',
          value: ')',
          rawValue: ')',
          repeatCount: count,
        });
        t += count - 1;
      } else {
        collapsed.push(token);
      }
    } else {
      collapsed.push(token);
    }
  }

  return collapsed;
}

/**
 * Resolves the color for a parsed combo token.
 */
export function getTokenColor(
  token: ComboToken,
  colors: Record<string, string> | { [key: string]: string },
  buttonColors?: Record<string, string>,
): string {
  switch (token.type) {
    case 'direction':
      return colors.direction || '#bdceef';
    case 'motion':
      return colors.direction || '#bdceef';
    case 'button':
      if (buttonColors?.[token.value]) {
        return buttonColors[token.value];
      }
      return colors.direction || '#bdceef';
    case 'modifier':
      if (token.value === 'CH') {
        return colors.separator || '#6c727e';
      }
      if (token.value.startsWith('(')) {
        return colors.separator || '#6c727e';
      }
      if (token.value.startsWith('[')) {
        const trimmed = token.value.trim();
        if (trimmed.endsWith(']')) {
          const bracketContent = trimmed.slice(1, -1).trim();
          const upperContent = bracketContent.toUpperCase();
          if (buttonColors?.[upperContent]) {
            return buttonColors[upperContent];
          }
        }
        return colors.separator || '#6c727e';
      }
      return colors.direction || '#bdceef';
    case 'separator':
      return colors.separator || '#6c727e';
    default:
      return colors.direction || '#bdceef';
  }
}

/**
 * Converts motion notation to a human-readable name.
 */
export function getMotionName(motion: string): string {
  const names: Record<string, string> = {
    '236': 'Quarter Circle Forward',
    '214': 'Quarter Circle Back',
    '623': 'Dragon Punch',
    '41236': 'Half Circle Forward',
    '63214': 'Half Circle Back',
    '22': 'Down Down',
    '66': 'Forward Forward',
    '44': 'Back Back',
    '88': 'Up Up',
    '360': 'Full Circle',
    '720': 'Double Circle',
  };
  return names[motion] || motion;
}
