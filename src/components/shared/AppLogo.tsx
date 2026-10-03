import appIcon from '../../../build/icon.png';

export function AppLogo({ className }: { className: string }) {
  return (
    <img
      src={appIcon}
      width={512}
      height={512}
      alt=""
      aria-hidden="true"
      draggable={false}
      fetchPriority="high"
      className={className}
    />
  );
}
