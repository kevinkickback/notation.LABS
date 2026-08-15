import { type ReactNode, useMemo } from 'react';
import { useSettings } from '@/context/SettingsContext';
import {
  getButtonAccessibilityLabel,
  getMechanicAccessibilityLabel,
  resolveNotationProfile,
} from '@/lib/notationProfiles';
import { getTokenColor } from '@/lib/parser';
import type { ComboToken, Game } from '@/lib/types';
import {
  DIRECTION_MODIFIERS,
  DIRECTION_NAMES,
  getDelimitedButton,
  getNrsHoldAssociations,
  getRepeatParenIndices,
  groupTokensWithButtons,
  isDescriptiveBracketAnnotation,
  isLiteralParenUnknown,
  isStructuralGroupingParen,
  LETTER_DIR_TO_NUMPAD,
  REPEAT_PAREN_COLOR,
  shouldRenderMechanicBadge,
  TEKKEN_EXPLICIT_MOVE_BOUNDARIES,
} from './comboDisplayUtils';
import { ButtonIcon } from './icons/ButtonIcon';
import { CounterHitIcon } from './icons/CounterHitIcon';
import { MotionIcon } from './icons/MotionIcon';

interface ComboDisplayProps {
  tokens: ComboToken[];
  game?: Game;
  mode?: 'colored-text' | 'visual-icons';
  className?: string;
}

export function ComboDisplay({
  tokens,
  game,
  mode = 'colored-text',
  className = '',
}: ComboDisplayProps) {
  const settings = useSettings();
  const colors = settings.notationColors;
  const comboScale = settings.comboScale ?? 1;
  const iconStyle = settings.iconStyle ?? 'hexagon';
  const motionIconStyle = settings.motionIconStyle ?? 'joystick';
  const notationProfile = resolveNotationProfile(game);
  const nrsHoldAssociations = useMemo(
    () =>
      notationProfile === 'nrs'
        ? getNrsHoldAssociations(tokens)
        : {
            heldInputIndices: new Set<number>(),
            appliedAnnotationIndices: new Set<number>(),
          },
    [notationProfile, tokens],
  );

  const repeatParenIndices = useMemo(
    () => getRepeatParenIndices(tokens),
    [tokens],
  );
  const groups = useMemo(
    () => groupTokensWithButtons(tokens, colors, game?.buttonColors),
    [tokens, colors, game?.buttonColors],
  );
  const indexedGroups = useMemo(() => {
    let flatIdx = 0;
    return groups.map((g) => ({
      buttonColor: g.buttonColor,
      tokens: g.tokens.map((t) => ({ token: t, flatIndex: flatIdx++ })),
    }));
  }, [groups]);

  const renderColoredToken = (
    token: ComboToken,
    idx: number,
    groupColor?: string,
  ) => {
    const isDescriptiveBracket = isDescriptiveBracketAnnotation(token);
    const isParenUnknown = isLiteralParenUnknown(token);
    const isStructuralParen = isStructuralGroupingParen(token);
    const isTekkenNeutral =
      notationProfile === 'tekken' &&
      token.type === 'direction' &&
      token.value.toLowerCase() === 'n';
    const color =
      !isDescriptiveBracket &&
      !isParenUnknown &&
      !isStructuralParen &&
      !isTekkenNeutral &&
      groupColor
        ? groupColor
        : getTokenColor(token, colors, game?.buttonColors);

    if (token.type === 'repeat-start') {
      if (!repeatParenIndices.has(idx)) return null;
      return (
        <span
          key={idx}
          style={{
            color: REPEAT_PAREN_COLOR,
            fontSize: `${1.125 * comboScale}rem`,
          }}
          className="font-medium tracking-tight"
        >
          (
        </span>
      );
    }

    if (token.type === 'repeat-end') {
      const showParen = repeatParenIndices.has(idx);
      const repeatDisplayValue = token.repeatLabel ?? token.repeatCount;
      return (
        <span key={idx} className="inline-flex items-baseline">
          {showParen && (
            <span
              style={{
                color: REPEAT_PAREN_COLOR,
                fontSize: `${1.125 * comboScale}rem`,
              }}
              className="font-medium tracking-tight"
            >
              )
            </span>
          )}
          <sup
            style={{
              color: REPEAT_PAREN_COLOR,
              fontSize: `${0.75 * comboScale}rem`,
            }}
            className="font-medium ml-0.5"
          >
            ×{repeatDisplayValue}
          </sup>
        </span>
      );
    }

    const isCH = token.type === 'modifier' && token.value === 'CH';
    const isParenAnnotation =
      token.type === 'modifier' && token.value.startsWith('(');
    const hasPreservedWhitespace = /\s$/.test(token.rawValue);
    const hasAdjacentSeparatorSpacing =
      token.type === 'separator' &&
      (hasPreservedWhitespace ||
        (idx > 0 && /\s$/.test(tokens[idx - 1].rawValue)));

    return (
      <span
        key={idx}
        style={{ color }}
        className={`${
          token.type === 'separator'
            ? `font-medium tracking-tight whitespace-pre${hasAdjacentSeparatorSpacing ? '' : ' mx-1'}`
            : isCH || isParenAnnotation
              ? 'font-medium tracking-tight whitespace-pre mx-1'
              : isDescriptiveBracket
                ? 'font-medium tracking-tight whitespace-pre mr-1'
                : 'font-medium tracking-tight whitespace-pre'
        }${isStructuralParen ? ' opacity-60' : ''}`}
      >
        {token.rawValue}
      </span>
    );
  };

  const renderIconToken = (
    token: ComboToken,
    idx: number,
    groupColor?: string,
  ) => {
    const isDescriptiveBracket = isDescriptiveBracketAnnotation(token);
    const isParenUnknown = isLiteralParenUnknown(token);
    const isStructuralParen = isStructuralGroupingParen(token);
    const isTekkenNeutral =
      notationProfile === 'tekken' &&
      token.type === 'direction' &&
      token.value.toLowerCase() === 'n';
    const color =
      !isDescriptiveBracket &&
      !isParenUnknown &&
      !isStructuralParen &&
      !isTekkenNeutral &&
      groupColor
        ? groupColor
        : getTokenColor(token, colors, game?.buttonColors);

    if (token.type === 'repeat-start') {
      if (!repeatParenIndices.has(idx)) return null;
      return (
        <span
          key={idx}
          style={{
            color: REPEAT_PAREN_COLOR,
            fontSize: `${1.125 * comboScale}rem`,
          }}
          className="font-medium"
        >
          (
        </span>
      );
    }

    if (token.type === 'repeat-end') {
      const showParen = repeatParenIndices.has(idx);
      const repeatDisplayValue = token.repeatLabel ?? token.repeatCount;
      return (
        <span key={idx} className="inline-flex items-baseline">
          {showParen && (
            <span
              style={{
                color: REPEAT_PAREN_COLOR,
                fontSize: `${1.125 * comboScale}rem`,
              }}
              className="font-medium"
            >
              )
            </span>
          )}
          <sup
            style={{
              color: REPEAT_PAREN_COLOR,
              fontSize: `${0.75 * comboScale}rem`,
            }}
            className="font-medium ml-0.5"
          >
            ×{repeatDisplayValue}
          </sup>
        </span>
      );
    }

    switch (token.type) {
      case 'motion':
        return (
          <MotionIcon
            key={idx}
            motion={token.value}
            size={Math.round(40 * comboScale)}
            color={color}
            iconStyle={motionIconStyle}
          />
        );
      case 'direction': {
        // Normalise letter directions to numpad for joystick mode; preserve case for arrows
        // mode so hold (D/F) and tap (d/f) resolve to different icons.
        const numpad =
          LETTER_DIR_TO_NUMPAD[token.value.toLowerCase()] ?? token.value;
        if (numpad === '5' && !isTekkenNeutral) return null;
        const isTekkenHold =
          notationProfile === 'tekken' &&
          token.value !== token.value.toLowerCase();
        const isNrsHold = nrsHoldAssociations.heldInputIndices.has(idx);
        const isHeldDirection = isTekkenHold || isNrsHold;
        const directionName =
          DIRECTION_NAMES[token.value.toLowerCase()] ?? token.value;
        const directionLabel = isTekkenNeutral
          ? 'Neutral'
          : notationProfile === 'tekken'
            ? `${isHeldDirection ? 'Hold' : 'Tap'} ${directionName}`
            : isHeldDirection
              ? `Hold ${directionName}`
              : directionName;
        const motionArg = isTekkenNeutral
          ? 'N'
          : motionIconStyle === 'arrows'
            ? token.value
            : numpad;
        return (
          <MotionIcon
            key={idx}
            motion={motionArg}
            size={Math.round(40 * comboScale)}
            color={color}
            iconStyle={motionIconStyle}
            hold={isHeldDirection}
            label={directionLabel}
          />
        );
      }
      case 'button': {
        const isHeldButton = nrsHoldAssociations.heldInputIndices.has(idx);
        const buttonLabel = getButtonAccessibilityLabel(
          notationProfile,
          token.value,
        );
        const buttonIcon = (
          <ButtonIcon
            button={token.value}
            size={Math.round(30 * comboScale)}
            color={color}
            iconStyle={iconStyle}
            label={isHeldButton ? `Hold ${buttonLabel}` : buttonLabel}
          />
        );
        return isHeldButton ? (
          <HeldInputIndicator key={idx}>{buttonIcon}</HeldInputIndicator>
        ) : (
          <span key={idx} className="inline-flex">
            {buttonIcon}
          </span>
        );
      }
      case 'modifier': {
        if (nrsHoldAssociations.appliedAnnotationIndices.has(idx)) {
          return null;
        }
        if (token.value === 'CH') {
          return (
            <CounterHitIcon
              key={idx}
              size={Math.round(30 * comboScale)}
              color={color}
            />
          );
        }
        const dirNum = DIRECTION_MODIFIERS[token.value.toLowerCase()];
        if (dirNum) {
          if (dirNum === '5') return null;
          return (
            <MotionIcon
              key={idx}
              motion={dirNum}
              size={Math.round(40 * comboScale)}
              color={color}
              iconStyle={motionIconStyle}
            />
          );
        }
        // Delimited inputs (e.g. [2] for held down or [A] for a held button).
        const delimitedButton = getDelimitedButton(token.value);
        if (delimitedButton && !isDescriptiveBracketAnnotation(token)) {
          const isSpecialKeyword = /^(charge|hold|release|whiff)$/i.test(
            delimitedButton.button,
          );
          if (!isSpecialKeyword) {
            const normalizedButton = delimitedButton.button.toUpperCase();
            const isHeldNumpadDirection =
              notationProfile === 'standard' &&
              delimitedButton.kind === 'hold' &&
              /^[1-46-9]$/.test(normalizedButton) &&
              !game?.buttonLayout.some(
                (button) => button.toUpperCase() === normalizedButton,
              );
            if (isHeldNumpadDirection) {
              return (
                <MotionIcon
                  key={idx}
                  motion={normalizedButton}
                  size={Math.round(40 * comboScale)}
                  color={color}
                  iconStyle={motionIconStyle}
                  hold
                  label={`Hold ${DIRECTION_NAMES[normalizedButton]}`}
                />
              );
            }
            const actionLabel =
              delimitedButton.kind === 'hold' ? 'Hold' : 'Release';
            return (
              <span key={idx} className="inline-flex items-center gap-0.5">
                <span
                  aria-hidden="true"
                  style={{ color, fontSize: `${1.1 * comboScale}rem` }}
                  className="font-medium opacity-60"
                >
                  {delimitedButton.leadingDelimiter}
                </span>
                <ButtonIcon
                  button={normalizedButton}
                  size={Math.round(30 * comboScale)}
                  color={color}
                  iconStyle={iconStyle}
                  label={`${actionLabel} ${getButtonAccessibilityLabel(
                    notationProfile,
                    normalizedButton,
                  )}`}
                />
                <span
                  aria-hidden="true"
                  style={{ color, fontSize: `${1.1 * comboScale}rem` }}
                  className="font-medium opacity-60"
                >
                  {delimitedButton.trailingDelimiter}
                </span>
              </span>
            );
          }
        }
        if (shouldRenderMechanicBadge(notationProfile, token.value)) {
          return (
            <MechanicBadge
              key={idx}
              value={token.value.trim()}
              color={color}
              label={getMechanicAccessibilityLabel(
                notationProfile,
                token.value,
              )}
            />
          );
        }
        if (
          notationProfile === 'tekken' &&
          (token.value === '(' || token.value === ')')
        ) {
          return (
            <span
              key={idx}
              role="img"
              aria-label={
                token.value === '('
                  ? 'Start required omitted input'
                  : 'End required omitted input'
              }
              className="font-medium opacity-60"
              style={{ color, fontSize: `${1.1 * comboScale}rem` }}
            >
              {token.value}
            </span>
          );
        }
        return (
          <span
            key={idx}
            className={`font-medium tracking-tight${token.value.startsWith('(') ? ' mx-1' : isDescriptiveBracketAnnotation(token) ? ' mr-1' : ''}${isStructuralParen ? ' opacity-60' : ''}`}
            style={{ color, fontSize: `${1.25 * comboScale}rem` }}
          >
            {token.value}
          </span>
        );
      }
      case 'separator':
        // Explicit Tekken 8-style boundaries make commas internal connectors.
        // Without one, commas remain legacy Tekken 7 move separators.
        if (notationProfile === 'tekken' && token.value === ',') {
          const hasExplicitMoveBoundary = tokens.some(
            (candidate) =>
              candidate.type === 'separator' &&
              TEKKEN_EXPLICIT_MOVE_BOUNDARIES.has(candidate.value),
          );
          if (hasExplicitMoveBoundary) return null;
        }
        return (
          <span
            key={idx}
            className="font-bold opacity-50 mx-1"
            style={{ color, fontSize: `${1.5 * comboScale}rem` }}
          >
            {TEKKEN_EXPLICIT_MOVE_BOUNDARIES.has(token.value) ||
            token.value === ','
              ? '→'
              : token.value}
          </span>
        );
      default:
        return (
          <span
            key={idx}
            className="font-mono"
            style={{ color, fontSize: `${1 * comboScale}rem` }}
          >
            {token.value}
          </span>
        );
    }
  };

  if (mode === 'colored-text') {
    return (
      <div
        className={`flex flex-wrap items-center font-mono ${className}`}
        style={{ fontSize: `${1.125 * comboScale}rem` }}
      >
        {indexedGroups.map((group, groupIdx) => {
          const groupKey = `${groupIdx}-${group.tokens.map(({ token }) => token.value).join('')}`;
          return (
            <div key={groupKey} className="flex items-center">
              {group.tokens.map(({ token, flatIndex }) =>
                renderColoredToken(token, flatIndex, group.buttonColor),
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {indexedGroups.map((group, groupIdx) => {
        const groupKey = `${groupIdx}-${group.tokens.map(({ token }) => token.value).join('')}`;
        return (
          <div key={groupKey} className="flex items-center gap-1">
            {group.tokens.map(({ token, flatIndex }) =>
              renderIconToken(token, flatIndex, group.buttonColor),
            )}
          </div>
        );
      })}
    </div>
  );
}

function HeldInputIndicator({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-flex">
      {children}
      <span
        aria-hidden="true"
        className="absolute -right-2 -bottom-1 rounded bg-background px-1 text-[8px] font-bold leading-none text-foreground ring-1 ring-border"
      >
        Hold
      </span>
    </span>
  );
}

function MechanicBadge({
  value,
  color,
  label = `${value} mechanic`,
}: {
  value: string;
  color: string;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className="rounded border border-current/40 bg-current/10 px-1.5 py-0.5 font-mono text-xs font-semibold"
      style={{ color }}
    >
      {value}
    </span>
  );
}
