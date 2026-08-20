import type { ComboToken } from './types';

// Bump when parser behavior changes and stored combo tokens need refreshing.
export const COMBO_NOTATION_PARSER_VERSION = 12;

import {
  COMMON_BUTTONS,
  DIRECTIONS,
  LETTER_DIR_CARDINALS,
  LETTER_DIR_COMPOUNDS,
  LETTER_DIR_STANCES,
  MOTION_ALIASES,
  MULTI_STEP_ALIASES,
  NRS_LETTER_DIR_COMPOUNDS,
  NRS_MODIFIERS,
  NRS_PARENTHETICALS,
  SEPARATORS,
  SORTED_ALL_ALIASES,
  SORTED_ALL_MODIFIERS,
  SORTED_LETTER_DIR_STANCES,
  SORTED_MOTIONS,
  SORTED_NRS_MODIFIERS,
  SORTED_TEKKEN_MECHANICS,
  SORTED_TEKKEN_MODIFIERS,
  SPECIAL_MODIFIERS,
  STANCE_MODIFIERS,
  TEKKEN_MECHANICS,
  TEKKEN_MODIFIERS,
} from './parserDefinitions';
import {
  consumeUnknownPhrase,
  findMatchingDelimiter,
  hasLetterBoundaryForButton,
  hasLetterBoundaryForWordToken,
  matchRepeat,
  type ParserOptions,
  resolveParserProfile,
} from './parserHelpers';

/**
 * Parses raw combo notation into displayable tokens.
 */
export function parseComboNotation(
  notation: string,
  customButtons: string[] = [],
  options?: ParserOptions,
): ComboToken[] {
  const profile = resolveParserProfile(options);
  const isButtonNumberProfile = profile !== 'standard';
  const isNrs = profile === 'nrs';
  const isTekken = profile === 'tekken';
  const tokens: ComboToken[] = [];
  // Numbered profiles skip the Standard button set so direction letters stay
  // available to their profile grammar.
  const allButtons =
    customButtons.length > 0
      ? [...customButtons]
      : isButtonNumberProfile
        ? []
        : [...COMMON_BUTTONS];
  // Numbered profiles reserve 1–4 for attacks rather than directions.
  if (isButtonNumberProfile) {
    allButtons.push('1', '2', '3', '4');
  }
  if (isNrs) {
    allButtons.push(
      'K',
      'S',
      'TH',
      'BL',
      'FL',
      'FP',
      'BP',
      'FK',
      'BK',
      'FS',
      'KM',
      'SS',
      'BLOCK',
      'GRAB',
      'THROW',
    );
  }
  const sortedButtons = [...allButtons].sort((a, b) => b.length - a.length);
  const activeDirections = isButtonNumberProfile
    ? DIRECTIONS.filter((d) => Number(d) > 4)
    : DIRECTIONS;
  const activeModifierKeys = isNrs
    ? [...SORTED_NRS_MODIFIERS, ...SORTED_ALL_MODIFIERS]
    : isTekken
      ? [...SORTED_TEKKEN_MODIFIERS, ...SORTED_ALL_MODIFIERS]
      : SORTED_ALL_MODIFIERS;
  if (isButtonNumberProfile) {
    activeModifierKeys.sort((a, b) => b.length - a.length);
  }

  const tryInlineRepeat = (pos: number): number => {
    const match = matchRepeat(input.substring(pos));
    if (match) {
      const lastToken = tokens.pop();
      if (lastToken) {
        tokens.push({ type: 'repeat-start', value: '(', rawValue: '(' });
        tokens.push(lastToken);
        tokens.push({
          type: 'repeat-end',
          value: ')',
          rawValue: ')',
          ...(match.repeatCount === undefined
            ? { repeatLabel: match.repeatLabel }
            : { repeatCount: match.repeatCount }),
        });
      }
      return match.length;
    }
    return 0;
  };

  const parseNotationLikeParenthetical = (
    content: string,
  ): ComboToken[] | undefined => {
    const trimmed = content.trim();
    if (!trimmed) {
      return undefined;
    }

    // A lone digit in Standard notation is commonly a descriptive note (e.g.
    // "2A(3)"). In numbered-button profiles it is an actual input instead.
    if (!isButtonNumberProfile && /^[1-9]$/.test(trimmed)) {
      return undefined;
    }

    const nestedTokens = parseComboNotation(content, customButtons, options);
    const containsInput = nestedTokens.some((token) =>
      ['direction', 'motion', 'button'].includes(token.type),
    );
    const containsUnknown = nestedTokens.some(
      (token) => token.type === 'unknown',
    );

    // Reparse only fully recognized input expressions. This avoids treating
    // descriptive numeric notes such as "(Level 3)" as combo notation.
    return containsInput && !containsUnknown ? nestedTokens : undefined;
  };

  let i = 0;
  const input = notation.trim();

  while (i < input.length) {
    if (/\s/.test(input[i])) {
      const whitespaceStart = i;
      while (i < input.length && /\s/.test(input[i])) {
        i++;
      }
      // Numbered-button notation commonly uses spaces between individual
      // inputs. Preserve authored whitespace without changing icon grammar.
      if (isButtonNumberProfile && tokens.length > 0) {
        tokens[tokens.length - 1].rawValue += input.substring(
          whitespaceStart,
          i,
        );
      }
      continue;
    }

    let matched = false;

    if (input[i] === '(') {
      const closeParenIndex = findMatchingDelimiter(input, i, '(', ')');
      if (closeParenIndex !== -1) {
        const afterParen = input.substring(closeParenIndex + 1);
        const repeatMatch = afterParen.match(/^\s*[xX*](\d+|N)/i);

        if (repeatMatch) {
          const repeatValue = repeatMatch[1];
          const repeatTokenFields = /^\d+$/.test(repeatValue)
            ? { repeatCount: parseInt(repeatValue, 10) }
            : { repeatLabel: repeatValue.toUpperCase() };
          const contentStart = i + 1;
          const contentEnd = closeParenIndex;
          const content = input.substring(contentStart, contentEnd);
          const fullMatchLength =
            closeParenIndex - i + 1 + repeatMatch[0].length;

          tokens.push({
            type: 'repeat-start',
            value: '(',
            rawValue: '(',
          });

          const nestedTokens = parseComboNotation(
            content,
            customButtons,
            options,
          );
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
          const nestedNotationTokens = parseNotationLikeParenthetical(content);

          if (normalizedParenthetical === '...' && isTekken) {
            const fullText = input.substring(i, closeParenIndex + 1);
            tokens.push({
              type: 'modifier',
              value: '(...)',
              rawValue: fullText,
            });
            i = closeParenIndex + 1;
          } else if (normalizedParenthetical === 'switch' && isTekken) {
            const fullText = input.substring(i, closeParenIndex + 1);
            tokens.push({
              type: 'modifier',
              value: '(Switch)',
              rawValue: fullText,
            });
            i = closeParenIndex + 1;
          } else if (isNrs && NRS_PARENTHETICALS[normalizedParenthetical]) {
            const fullText = input.substring(i, closeParenIndex + 1);
            tokens.push({
              type: 'modifier',
              value: NRS_PARENTHETICALS[normalizedParenthetical],
              rawValue: fullText,
            });
            i = closeParenIndex + 1;
          } else if (nestedNotationTokens) {
            tokens.push({
              type: 'modifier',
              value: '(',
              rawValue: '(',
            });
            tokens.push(...nestedNotationTokens);
            tokens.push({
              type: 'modifier',
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

    // Inverse brackets delimit a button release (e.g. ]D[). Resolve the
    // complete token before individual punctuation can become unknown text.
    if (input[i] === ']') {
      const openBracketIndex = input.indexOf('[', i + 1);
      const releaseContent = input.substring(i + 1, openBracketIndex);
      if (
        openBracketIndex > i + 1 &&
        !releaseContent.includes(']') &&
        !releaseContent.includes('[')
      ) {
        let tokenEnd = openBracketIndex + 1;
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

    if (input[i] === '[') {
      const closeBracketIndex = findMatchingDelimiter(input, i, '[', ']');
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

    // Curly braces denote Tekken throw-escape notation e.g. {1+2}.
    if (input[i] === '{') {
      const closeIdx = input.indexOf('}', i + 1);
      if (closeIdx !== -1) {
        const fullText = input.substring(i, closeIdx + 1);
        tokens.push({ type: 'modifier', value: fullText, rawValue: fullText });
        i = closeIdx + 1;
        matched = true;
      }
    }
    if (matched) continue;

    // Punctuation makes these Tekken mechanics unambiguous, so resolve them
    // before customizable button names such as W or WB.
    if (isTekken) {
      for (const mechanicKey of SORTED_TEKKEN_MECHANICS) {
        if (
          input.substring(i, i + mechanicKey.length).toLowerCase() ===
          mechanicKey
        ) {
          tokens.push({
            type: 'modifier',
            value: TEKKEN_MECHANICS[mechanicKey],
            rawValue: input.substring(i, i + mechanicKey.length),
          });
          i += mechanicKey.length;
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    // Tekken compact dashes are motions; case remains meaningful for ordinary
    // directions, so only lowercase shorthand is normalized here.
    if (isTekken) {
      const compactDash = input.substring(i).match(/^(fff|ff|bb)/);
      if (compactDash) {
        const rawDash = compactDash[1];
        tokens.push({
          type: 'motion',
          value: rawDash === 'bb' ? '44' : rawDash === 'fff' ? '666' : '66',
          rawValue: rawDash,
        });
        i += rawDash.length;
        matched = true;
      }
    }
    if (matched) continue;

    // Slash diagonals must be resolved before '/' is consumed as a separator.
    if (isButtonNumberProfile) {
      // Ground positions (FD/FT, FU/FA, etc.) also contain '/' and must be checked first.
      if (isTekken) {
        const groundPositions: Record<string, string> = {
          'fd/ft': 'FD/FT',
          'fd/fa': 'FD/FA',
          'fu/ft': 'FU/FT',
          'fu/fa': 'FU/FA',
          fdft: 'FD/FT',
          fdfa: 'FD/FA',
          fuft: 'FU/FT',
          fufa: 'FU/FA',
        };
        for (const [key, value] of Object.entries(groundPositions)) {
          if (input.substring(i, i + key.length).toLowerCase() === key) {
            tokens.push({
              type: 'modifier',
              value,
              rawValue: input.substring(i, i + key.length),
            });
            i += key.length;
            matched = true;
            break;
          }
        }
        if (matched) continue;
      }

      const profileCompounds = isTekken
        ? LETTER_DIR_COMPOUNDS
        : NRS_LETTER_DIR_COMPOUNDS;
      for (const dir of profileCompounds) {
        if (input.substring(i, i + dir.length).toLowerCase() === dir) {
          const rawDir = input.substring(i, i + dir.length);
          const canonicalDirection =
            isTekken && rawDir === rawDir.toUpperCase()
              ? rawDir.toUpperCase()
              : rawDir.toLowerCase();
          tokens.push({
            type: 'direction',
            value: canonicalDirection,
            rawValue: rawDir,
          });
          i += dir.length;
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    for (const sep of SEPARATORS) {
      const chunk = input.substring(i, i + sep.length);
      const isWordSeparator = /^[a-z]+$/i.test(sep);
      if (
        (chunk === sep ||
          (isWordSeparator && chunk.toLowerCase() === sep.toLowerCase())) &&
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

    for (const modKey of activeModifierKeys) {
      if (
        isTekken &&
        /^[a-z]$/i.test(modKey) &&
        customButtons.some(
          (button) => button.toUpperCase() === modKey.toUpperCase(),
        )
      ) {
        continue;
      }
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
          (isTekken ? TEKKEN_MODIFIERS[modKey] : undefined) ||
          (isNrs ? NRS_MODIFIERS[modKey] : undefined) ||
          STANCE_MODIFIERS[modKey] ||
          SPECIAL_MODIFIERS[modKey];
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

    // Aliases (qcf, dp, hcf, etc.) are valid in all modes — Tekken uses them.
    for (const alias of SORTED_ALL_ALIASES) {
      const normalizedInput = input
        .substring(i, i + alias.length)
        .toLowerCase()
        .replace(/\s+/g, '');
      const normalizedAlias = alias.toLowerCase().replace(/\s+/g, '');

      if (
        normalizedInput === normalizedAlias &&
        hasLetterBoundaryForWordToken(input, i, alias.length, alias)
      ) {
        let matchLength = alias.length;
        // Auto-consume trailing dot delimiter (e.g. dp.HP → motion "dp." + button "HP")
        if (i + matchLength < input.length && input[i + matchLength] === '.') {
          matchLength++;
        }
        const multiSteps = MULTI_STEP_ALIASES[alias];
        if (multiSteps) {
          // Emit each step separately; rawValue on first token only.
          for (let s = 0; s < multiSteps.length; s++) {
            tokens.push({
              type: multiSteps[s].type,
              value: multiSteps[s].value,
              rawValue:
                s === 0
                  ? input.substring(i, i + matchLength)
                  : multiSteps[s].value,
            });
          }
        } else {
          const numpadValue = MOTION_ALIASES[alias];
          tokens.push({
            type: 'motion',
            value: numpadValue,
            rawValue: input.substring(i, i + matchLength),
          });
        }
        i += matchLength;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Numeric motions (236, 214, etc.) are disabled in numbered-button profiles
    // since those digits are named buttons or cardinal directions.
    if (!isButtonNumberProfile) {
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
    }

    for (const dir of activeDirections) {
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

    // NRS letter directions are sequential and case-insensitive.
    // Only consume a compact direction run when it is followed by notation
    // syntax, which prevents ordinary words from being split into directions.
    if (isNrs) {
      const directionRun = input
        .substring(i)
        .match(/^[fbud]+(?=[1-4+~,:=_<>#.\x5b\x5d()\s]|$)/i);
      if (directionRun) {
        const rawDirection = input[i];
        tokens.push({
          type: 'direction',
          value: rawDirection.toLowerCase(),
          rawValue: rawDirection,
        });
        i++;
        matched = true;
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

    // Cardinal letter directions and stances — Tekken only, checked
    // after custom buttons so game-defined 'F'/'B' buttons take priority.
    if (isTekken) {
      for (const stanceKey of SORTED_LETTER_DIR_STANCES) {
        if (
          input.substring(i, i + stanceKey.length).toLowerCase() ===
            stanceKey &&
          hasLetterBoundaryForWordToken(input, i, stanceKey.length, stanceKey)
        ) {
          tokens.push({
            type: 'modifier',
            value: LETTER_DIR_STANCES[stanceKey],
            rawValue: input.substring(i, i + stanceKey.length),
          });
          i += stanceKey.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        for (const dir of LETTER_DIR_CARDINALS) {
          if (
            input[i].toLowerCase() === dir &&
            hasLetterBoundaryForWordToken(input, i, 1, dir)
          ) {
            tokens.push({
              type: 'direction',
              // Preserve original case: F = hold forward, f = tap forward
              value: input[i],
              rawValue: input[i],
            });
            i++;
            matched = true;
            break;
          }
        }
      }
    }
    if (matched) continue;

    const unknownPhrase = consumeUnknownPhrase(input, i, isButtonNumberProfile);
    const unknownChar = unknownPhrase || input[i];
    tokens.push({
      type: 'unknown',
      value: unknownChar,
      rawValue: unknownChar,
    });
    i += unknownChar.length;
  }

  if (isNrs) {
    return tokens;
  }

  // Collapse consecutive identical buttons into repeat groups (e.g. LLL → L×3).
  const collapsed: ComboToken[] = [];
  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    if (token.type === 'button') {
      let count = 1;
      while (
        t + count < tokens.length &&
        !/\s$/.test(tokens[t + count - 1].rawValue) &&
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
