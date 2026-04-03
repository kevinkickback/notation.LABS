import { useId } from 'react';
import type { IconStyle } from '@/lib/types';

interface ButtonIconProps {
  button: string;
  size?: number;
  color?: string;
  className?: string;
  iconStyle?: IconStyle;
}

function resolveShape(
  _button: string,
  iconStyle: IconStyle,
): 'circle' | 'square' | 'hexagon' {
  if (iconStyle === 'round') return 'circle';
  if (iconStyle === 'square') return 'square';
  return 'hexagon';
}

export function ButtonIcon({
  button,
  size = 36,
  color = 'currentColor',
  className = '',
  iconStyle = 'hexagon',
}: ButtonIconProps) {
  const titleId = useId();

  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 36 36',
    className,
  };

  const shape = resolveShape(button, iconStyle);

  return (
    <svg {...svgProps} role="img" aria-labelledby={titleId}>
      <title id={titleId}>{`Button ${button}`}</title>
      {shape === 'circle' && (
        <>
          <circle
            cx="18"
            cy="18"
            r="16"
            fill={color}
            opacity="0.2"
            stroke="none"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
          />
        </>
      )}

      {shape === 'square' && (
        <>
          <rect
            x="4"
            y="4"
            width="28"
            height="28"
            rx="4"
            fill={color}
            opacity="0.2"
            stroke="none"
          />
          <rect
            x="4"
            y="4"
            width="28"
            height="28"
            rx="4"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
          />
        </>
      )}

      {shape === 'hexagon' && (
        <>
          <path
            d="M 18 2 L 32 10 L 32 26 L 18 34 L 4 26 L 4 10 Z"
            fill={color}
            opacity="0.2"
            stroke="none"
          />
          <path
            d="M 18 2 L 32 10 L 32 26 L 18 34 L 4 26 L 4 10 Z"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
          />
        </>
      )}

      <text
        x="18"
        y="18"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fontWeight="700"
        fill={color}
        stroke="none"
      >
        {button}
      </text>
    </svg>
  );
}
