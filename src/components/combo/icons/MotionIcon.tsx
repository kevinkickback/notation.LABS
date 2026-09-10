import btn1Url from '@/assets/button-icons/tekken/1.svg?url';
import btn2Url from '@/assets/button-icons/tekken/2.svg?url';
import btn3Url from '@/assets/button-icons/tekken/3.svg?url';
import btn4Url from '@/assets/button-icons/tekken/4.svg?url';
import holdBackUrl from '@/assets/motion-icons/arrows/hold/back.svg?url';
import holdDownUrl from '@/assets/motion-icons/arrows/hold/down.svg?url';
import holdDownBackUrl from '@/assets/motion-icons/arrows/hold/down-back.svg?url';
import holdDownForwardUrl from '@/assets/motion-icons/arrows/hold/down-forward.svg?url';
import holdForwardUrl from '@/assets/motion-icons/arrows/hold/forward.svg?url';
import holdUpUrl from '@/assets/motion-icons/arrows/hold/up.svg?url';
import holdUpBackUrl from '@/assets/motion-icons/arrows/hold/up-back.svg?url';
import holdUpForwardUrl from '@/assets/motion-icons/arrows/hold/up-forward.svg?url';
import tapBackUrl from '@/assets/motion-icons/arrows/tap/back.svg?url';
import tapDownUrl from '@/assets/motion-icons/arrows/tap/down.svg?url';
import tapDownBackUrl from '@/assets/motion-icons/arrows/tap/down-back.svg?url';
import tapDownForwardUrl from '@/assets/motion-icons/arrows/tap/down-forward.svg?url';
import tapForwardUrl from '@/assets/motion-icons/arrows/tap/forward.svg?url';
import tapUpUrl from '@/assets/motion-icons/arrows/tap/up.svg?url';
import tapUpBackUrl from '@/assets/motion-icons/arrows/tap/up-back.svg?url';
import tapUpForwardUrl from '@/assets/motion-icons/arrows/tap/up-forward.svg?url';
import joystickDpUrl from '@/assets/motion-icons/joystick/dp.svg?url';
import joystickHcbUrl from '@/assets/motion-icons/joystick/hcb.svg?url';
import joystickHcfUrl from '@/assets/motion-icons/joystick/hcf.svg?url';
import holdJoystickBackUrl from '@/assets/motion-icons/joystick/hold/back.svg?url';
import holdJoystickDownUrl from '@/assets/motion-icons/joystick/hold/down.svg?url';
import holdJoystickDownBackUrl from '@/assets/motion-icons/joystick/hold/down-back.svg?url';
import holdJoystickDownForwardUrl from '@/assets/motion-icons/joystick/hold/down-forward.svg?url';
import holdJoystickForwardUrl from '@/assets/motion-icons/joystick/hold/forward.svg?url';
import holdJoystickUpUrl from '@/assets/motion-icons/joystick/hold/up.svg?url';
import holdJoystickUpBackUrl from '@/assets/motion-icons/joystick/hold/up-back.svg?url';
import holdJoystickUpForwardUrl from '@/assets/motion-icons/joystick/hold/up-forward.svg?url';
import joystickQcbUrl from '@/assets/motion-icons/joystick/qcb.svg?url';
import joystickQcfUrl from '@/assets/motion-icons/joystick/qcf.svg?url';
import joystickRdpUrl from '@/assets/motion-icons/joystick/rdp.svg?url';
import joystickSpdUrl from '@/assets/motion-icons/joystick/spd.svg?url';
import tapJoystickBackUrl from '@/assets/motion-icons/joystick/tap/back.svg?url';
import tapJoystickDownUrl from '@/assets/motion-icons/joystick/tap/down.svg?url';
import tapJoystickDownBackUrl from '@/assets/motion-icons/joystick/tap/down-back.svg?url';
import tapJoystickDownForwardUrl from '@/assets/motion-icons/joystick/tap/down-forward.svg?url';
import tapJoystickForwardUrl from '@/assets/motion-icons/joystick/tap/forward.svg?url';
import tapJoystickUpUrl from '@/assets/motion-icons/joystick/tap/up.svg?url';
import tapJoystickUpBackUrl from '@/assets/motion-icons/joystick/tap/up-back.svg?url';
import tapJoystickUpForwardUrl from '@/assets/motion-icons/joystick/tap/up-forward.svg?url';

const ARROW_ICON_MAP: Readonly<Record<string, string>> = {
  '1': tapDownBackUrl,
  '2': tapDownUrl,
  '3': tapDownForwardUrl,
  '4': tapBackUrl,
  '6': tapForwardUrl,
  '7': tapUpBackUrl,
  '8': tapUpUrl,
  '9': tapUpForwardUrl,
  f: tapForwardUrl,
  b: tapBackUrl,
  u: tapUpUrl,
  d: tapDownUrl,
  'd/f': tapDownForwardUrl,
  'd/b': tapDownBackUrl,
  'u/f': tapUpForwardUrl,
  'u/b': tapUpBackUrl,
  df: tapDownForwardUrl,
  db: tapDownBackUrl,
  uf: tapUpForwardUrl,
  ub: tapUpBackUrl,
  F: holdForwardUrl,
  B: holdBackUrl,
  D: holdDownUrl,
  U: holdUpUrl,
  'D/F': holdDownForwardUrl,
  'D/B': holdDownBackUrl,
  'U/F': holdUpForwardUrl,
  'U/B': holdUpBackUrl,
  DF: holdDownForwardUrl,
  DB: holdDownBackUrl,
  UF: holdUpForwardUrl,
  UB: holdUpBackUrl,
  '1b': btn1Url,
  '2b': btn2Url,
  '3b': btn3Url,
  '4b': btn4Url,
};

const HOLD_ARROW_ICON_MAP: Readonly<Record<string, string>> = {
  '1': holdDownBackUrl,
  '2': holdDownUrl,
  '3': holdDownForwardUrl,
  '4': holdBackUrl,
  '6': holdForwardUrl,
  '7': holdUpBackUrl,
  '8': holdUpUrl,
  '9': holdUpForwardUrl,
  f: holdForwardUrl,
  b: holdBackUrl,
  u: holdUpUrl,
  d: holdDownUrl,
  'd/f': holdDownForwardUrl,
  'd/b': holdDownBackUrl,
  'u/f': holdUpForwardUrl,
  'u/b': holdUpBackUrl,
  df: holdDownForwardUrl,
  db: holdDownBackUrl,
  uf: holdUpForwardUrl,
  ub: holdUpBackUrl,
};

type DirectionStep = '1' | '2' | '3' | '4' | '6' | '7' | '8' | '9';
type JoystickStep =
  | DirectionStep
  | 'qcf'
  | 'qcb'
  | 'dp'
  | 'rdp'
  | 'hcf'
  | 'hcb'
  | 'spd';

const TAP_JOYSTICK_DIRECTION_MAP: Record<DirectionStep, string> = {
  '1': tapJoystickDownBackUrl,
  '2': tapJoystickDownUrl,
  '3': tapJoystickDownForwardUrl,
  '4': tapJoystickBackUrl,
  '6': tapJoystickForwardUrl,
  '7': tapJoystickUpBackUrl,
  '8': tapJoystickUpUrl,
  '9': tapJoystickUpForwardUrl,
};

const HOLD_JOYSTICK_DIRECTION_MAP: Record<DirectionStep, string> = {
  '1': holdJoystickDownBackUrl,
  '2': holdJoystickDownUrl,
  '3': holdJoystickDownForwardUrl,
  '4': holdJoystickBackUrl,
  '6': holdJoystickForwardUrl,
  '7': holdJoystickUpBackUrl,
  '8': holdJoystickUpUrl,
  '9': holdJoystickUpForwardUrl,
};

const JOYSTICK_MOTION_MAP: Record<
  Exclude<JoystickStep, DirectionStep>,
  string
> = {
  qcf: joystickQcfUrl,
  qcb: joystickQcbUrl,
  dp: joystickDpUrl,
  rdp: joystickRdpUrl,
  hcf: joystickHcfUrl,
  hcb: joystickHcbUrl,
  spd: joystickSpdUrl,
};

const JOYSTICK_STEPS: Readonly<Record<string, readonly JoystickStep[]>> = {
  '1': ['1'],
  '2': ['2'],
  '3': ['3'],
  '4': ['4'],
  '6': ['6'],
  '7': ['7'],
  '8': ['8'],
  '9': ['9'],
  '22': ['2', '2'],
  '28': ['2', '8'],
  '44': ['4', '4'],
  '46': ['4', '6'],
  '64': ['6', '4'],
  '66': ['6', '6'],
  '82': ['8', '2'],
  '88': ['8', '8'],
  '214': ['qcb'],
  '236': ['qcf'],
  '360': ['spd'],
  '421': ['rdp'],
  '426': ['4', '2', '6'],
  '623': ['dp'],
  '624': ['6', '2', '4'],
  '632': ['6', '3', '2'],
  '666': ['6', '6', '6'],
  '720': ['spd', 'spd'],
  '1080': ['spd', 'spd', 'spd'],
  '2369': ['qcf', '9'],
  '63214': ['hcb'],
  '41236': ['hcf'],
  '214214': ['qcb', 'qcb'],
  '236236': ['qcf', 'qcf'],
  '412364': ['hcf', '4'],
  '632146': ['hcb', '6'],
  qcf: ['qcf'],
  qcb: ['qcb'],
  dp: ['dp'],
  rdp: ['rdp'],
  hcf: ['hcf'],
  hcb: ['hcb'],
  spd: ['spd'],
};

const CIRCULAR_MOTION_REPEATS: Readonly<Record<string, number>> = {
  '360': 1,
  '720': 2,
  '1080': 3,
  spd: 1,
};

const FULL_CIRCLE_ARROW_STEPS: readonly DirectionStep[] = [
  '6',
  '3',
  '2',
  '1',
  '4',
  '7',
  '8',
  '9',
];

const DIRECTION_LABELS: Readonly<Record<string, string>> = {
  '1': 'DownBack',
  '2': 'Down',
  '3': 'DownForward',
  '4': 'Back',
  '6': 'Forward',
  '7': 'UpBack',
  '8': 'Up',
  '9': 'UpForward',
};

const MOTION_LABELS: Readonly<Record<string, string>> = {
  '22': 'Down',
  '28': 'Down-Up',
  '44': 'Back',
  '46': 'Back-Forward',
  '64': 'Forward-Back',
  '66': 'Forward',
  '82': 'Up-Down',
  '88': 'Up',
  '214': 'QCB',
  '236': 'QCF',
  '360': '360',
  '421': 'RDP',
  '426': 'Back-Down-Forward',
  '623': 'DP',
  '624': 'Forward-Down-Back',
  '632': 'Forward-DownForward-Down',
  '666': 'Forward',
  '720': '720',
  '1080': '1080',
  '2369': 'Tiger Knee',
  '63214': 'HCB',
  '41236': 'HCF',
  '214214': 'Double QCB',
  '236236': 'Double QCF',
  '412364': 'HCF-Back',
  '632146': 'HCB-Forward',
  qcf: 'QCF',
  qcb: 'QCB',
  dp: 'DP',
  rdp: 'RDP',
  hcf: 'HCF',
  hcb: 'HCB',
  spd: '360',
};

interface MotionIconProps {
  motion: string;
  label?: string;
  hold?: boolean;
  size?: number;
  color?: string;
  className?: string;
  iconStyle?: 'joystick' | 'arrows';
}

function getJoystickSource(step: JoystickStep, hold: boolean): string {
  if (step in TAP_JOYSTICK_DIRECTION_MAP) {
    const direction = step as DirectionStep;
    return (hold ? HOLD_JOYSTICK_DIRECTION_MAP : TAP_JOYSTICK_DIRECTION_MAP)[
      direction
    ];
  }

  return JOYSTICK_MOTION_MAP[step as Exclude<JoystickStep, DirectionStep>];
}

export function MotionIcon({
  motion,
  label,
  hold = false,
  size = 48,
  color = 'currentColor',
  className = '',
  iconStyle = 'joystick',
}: MotionIconProps) {
  if (motion.toLowerCase() === 'n') {
    const neutralLabel = label ?? 'Neutral';
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        className={className}
        role="img"
        aria-label={neutralLabel}
      >
        <title>{neutralLabel}</title>
        <circle cx="24" cy="24" r="18" fill={color} opacity="0.16" />
        <path
          d="m24 10 3.6 9.1 9.7.6-7.5 6.2 2.4 9.4-8.2-5.2-8.2 5.2 2.4-9.4-7.5-6.2 9.7-.6L24 10Z"
          fill={color}
        />
      </svg>
    );
  }

  if (iconStyle === 'arrows') {
    const arrowUrl =
      (hold ? HOLD_ARROW_ICON_MAP[motion.toLowerCase()] : undefined) ??
      ARROW_ICON_MAP[motion] ??
      ARROW_ICON_MAP[motion.toLowerCase()];
    const arrowSize = Math.round(size * 0.8);

    if (arrowUrl) {
      return (
        <div className={`inline-flex items-center ${className}`}>
          <img
            src={arrowUrl}
            width={arrowSize}
            height={arrowSize}
            alt={label ?? DIRECTION_LABELS[motion] ?? `Direction ${motion}`}
          />
        </div>
      );
    }

    const circleRepeats = CIRCULAR_MOTION_REPEATS[motion.toLowerCase()];
    const arrowSteps = circleRepeats
      ? Array.from(
          { length: circleRepeats },
          () => FULL_CIRCLE_ARROW_STEPS,
        ).flat()
      : motion.split('');
    const allDecomposable =
      arrowSteps.length > 0 &&
      arrowSteps.every((step) => /^[1-9]$/.test(step) && ARROW_ICON_MAP[step]);

    if (allDecomposable) {
      return (
        <div className={`inline-flex items-center gap-0.5 ${className}`}>
          {arrowSteps.map((step, index) => (
            <img
              // biome-ignore lint/suspicious/noArrayIndexKey: order is stable
              key={index}
              src={(hold ? HOLD_ARROW_ICON_MAP : ARROW_ICON_MAP)[step]}
              width={arrowSize}
              height={arrowSize}
              alt={
                label
                  ? `${label}, step ${index + 1}`
                  : (DIRECTION_LABELS[step] ?? step)
              }
            />
          ))}
        </div>
      );
    }
  }

  const joystickSteps = JOYSTICK_STEPS[motion.toLowerCase()];
  if (joystickSteps) {
    const motionLabel =
      label ??
      MOTION_LABELS[motion.toLowerCase()] ??
      DIRECTION_LABELS[motion] ??
      `Motion ${motion}`;
    const renderHeight = size;

    return (
      <div
        className={`inline-flex items-center gap-0.5${hold ? ' motion-icon--hold' : ''} ${className}`}
        role="img"
        aria-label={motionLabel}
      >
        {joystickSteps.map((step, index) => (
          <img
            // biome-ignore lint/suspicious/noArrayIndexKey: order is stable
            key={index}
            src={getJoystickSource(step, hold)}
            height={renderHeight}
            style={{
              height: renderHeight,
              width: 'auto',
              maxWidth: 'none',
              flexShrink: 0,
            }}
            alt=""
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  const fallbackLabel = label ?? `Motion ${motion.trim() || 'unknown'}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={fallbackLabel}
    >
      <title>{fallbackLabel}</title>
      <circle
        cx="24"
        cy="24"
        r="18"
        opacity="0.15"
        fill={color}
        stroke="none"
      />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="16"
        fontWeight="600"
        fill={color}
        stroke="none"
      >
        {motion}
      </text>
    </svg>
  );
}
