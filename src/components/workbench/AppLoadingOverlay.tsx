import { CheckCircleIcon } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export type StartupStage = 'settings' | 'parsing' | 'library' | 'ready';

const STAGES = {
  settings: { progress: 20, description: 'Restoring your preferences…' },
  parsing: { progress: 50, description: 'Updating stored combo notation…' },
  library: { progress: 75, description: 'Opening your game library…' },
  ready: { progress: 100, description: 'Workspace ready' },
};

export function AppLoadingOverlay({
  stage,
  error,
  onRetry,
  onComplete,
}: {
  stage: StartupStage;
  error: string | null;
  onRetry: () => void;
  onComplete: () => void;
}) {
  const [fading, setFading] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const statusId = useId();
  const { progress, description } = STAGES[stage];

  useEffect(() => {
    overlay.current?.focus();
  }, []);
  useEffect(() => {
    if (stage !== 'ready' || error) {
      setFading(false);
      return;
    }
    const fadeTimer = setTimeout(() => setFading(true), 450);
    const completeTimer = setTimeout(onComplete, 650);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [stage, error, onComplete]);

  return (
    <div
      ref={overlay}
      className="app-loading-overlay"
      data-fading={fading}
      data-testid="app-loading-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={statusId}
      aria-busy={stage !== 'ready' && !error}
      tabIndex={-1}
    >
      <div className="startup-brand">
        <h1 id={titleId}>
          notation<span>.LABS</span>
        </h1>
        <p>Fighting game combo notebook</p>
      </div>
      <div className="startup-progress">
        <progress max={100} value={progress} aria-label="Startup progress" />
        <output id={statusId} aria-live="polite" aria-atomic="true">
          {stage === 'ready' && !error && (
            <CheckCircleIcon size={17} weight="fill" />
          )}
          <span>{error ? 'Could not open your workspace' : description}</span>
        </output>
      </div>
      {error && (
        <div className="startup-error">
          <p role="alert">{error}</p>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
