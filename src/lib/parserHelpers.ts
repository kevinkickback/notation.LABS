import type { NotationProfile } from './types';

export interface ParserOptions {
  profile?: NotationProfile;
  inputType?: 'numpad' | 'button-numbers';
}

export function resolveParserProfile(options?: ParserOptions): NotationProfile {
  return (
    options?.profile ??
    (options?.inputType === 'button-numbers' ? 'tekken' : 'standard')
  );
}

export function isAsciiLetter(value: string | undefined): boolean {
  return Boolean(value && /[a-z]/i.test(value));
}

export function hasLetterBoundaryForButton(
  input: string,
  start: number,
  buttonLength: number,
  buttonText: string,
): boolean {
  if (!/^[a-z]+$/i.test(buttonText)) return true;

  const previous = start > 0 ? input[start - 1] : undefined;
  const next = input[start + buttonLength];
  if (!isAsciiLetter(previous) && !isAsciiLetter(next)) return true;

  const normalizedButton = buttonText.toLowerCase();
  let runStart = start;
  let runEnd = start + buttonLength;
  while (
    runStart >= buttonLength &&
    input.substring(runStart - buttonLength, runStart).toLowerCase() ===
      normalizedButton
  ) {
    runStart -= buttonLength;
  }
  while (
    input.substring(runEnd, runEnd + buttonLength).toLowerCase() ===
    normalizedButton
  ) {
    runEnd += buttonLength;
  }

  return (
    runEnd - runStart > buttonLength &&
    !isAsciiLetter(input[runStart - 1]) &&
    !isAsciiLetter(input[runEnd])
  );
}

export function hasLetterBoundaryForWordToken(
  input: string,
  start: number,
  tokenLength: number,
  tokenText: string,
): boolean {
  if (!/^[a-z]+$/i.test(tokenText)) return true;
  const previous = start > 0 ? input[start - 1] : undefined;
  const next = input[start + tokenLength];
  return !isAsciiLetter(previous) && !isAsciiLetter(next);
}

export function consumeUnknownPhrase(
  input: string,
  start: number,
  isButtonNumberProfile: boolean,
): string {
  let end = start;
  while (end < input.length) {
    const character = input[end];
    if (character === ' ') {
      const previous = end > start ? input[end - 1] : undefined;
      const next = end + 1 < input.length ? input[end + 1] : undefined;
      if (isAsciiLetter(previous) && isAsciiLetter(next)) {
        end++;
        continue;
      }
      if (
        !isButtonNumberProfile &&
        isAsciiLetter(previous) &&
        next &&
        /[0-9]/.test(next)
      ) {
        const afterDigit = end + 2 < input.length ? input[end + 2] : '';
        if (!afterDigit || /[^a-zA-Z0-9]/.test(afterDigit)) {
          end += 2;
          continue;
        }
      }
      break;
    }
    if ('()[]{}<>+~,/|'.includes(character) || /[0-9]/.test(character)) {
      break;
    }
    if (isAsciiLetter(character)) {
      end++;
      continue;
    }
    break;
  }
  return input.substring(start, end);
}

export interface RepeatMatch {
  length: number;
  repeatCount?: number;
  repeatLabel?: string;
}

export function matchRepeat(input: string): RepeatMatch | null {
  const match = input.match(/^[xX*](\d+|N)/i);
  if (!match) return null;
  const value = match[1];
  return /^\d+$/.test(value)
    ? { length: match[0].length, repeatCount: Number.parseInt(value, 10) }
    : { length: match[0].length, repeatLabel: value.toUpperCase() };
}

export function findMatchingDelimiter(
  input: string,
  start: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  for (let index = start; index < input.length; index++) {
    if (input[index] === open) depth++;
    if (input[index] === close) {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}
