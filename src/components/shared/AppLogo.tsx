import compactLogo from '@/assets/branding/app-mark.svg';
import splashLogo from '@/assets/branding/splash-logo.png';

export function AppLogo({
  className,
  variant = 'compact',
}: {
  className: string;
  variant?: 'compact' | 'splash';
}) {
  const size = variant === 'splash' ? 512 : 32;
  return (
    <img
      src={variant === 'splash' ? splashLogo : compactLogo}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      fetchPriority="high"
      className={className}
    />
  );
}
