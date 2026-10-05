import { useId } from 'react';
import { readableColor } from '@/lib/colorContrast';

interface CounterHitIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function CounterHitIcon({
  size = 36,
  color = 'currentColor',
  className = '',
}: CounterHitIconProps) {
  const titleId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className={className}
      style={{ color: readableColor(color) }}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>Counter Hit</title>
      {/* Starburst / impact shape */}
      <polygon
        points="18,1 21.5,12 33,8 24,16 35,18 24,20 33,28 21.5,24 18,35 14.5,24 3,28 12,20 1,18 12,16 3,8 14.5,12"
        fill="currentColor"
        opacity="0.08"
        stroke="none"
      />
      <polygon
        points="18,1 21.5,12 33,8 24,16 35,18 24,20 33,28 21.5,24 18,35 14.5,24 3,28 12,20 1,18 12,16 3,8 14.5,12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* CH text */}
      <text
        x="18"
        y="19"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fontWeight="800"
        fill="currentColor"
        stroke="none"
      >
        CH
      </text>
    </svg>
  );
}
