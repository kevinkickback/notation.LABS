import { ArrowClockwiseIcon, WarningIcon } from '@phosphor-icons/react';
import type { FallbackProps } from 'react-error-boundary';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Button } from './components/ui/button';

export const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  if (import.meta.env.DEV) throw error;

  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-6">
          <WarningIcon />
          <AlertTitle>Application Error</AlertTitle>
          <AlertDescription>
            Something unexpected happened while running the application. The
            error details are shown below.
          </AlertDescription>
        </Alert>

        <div className="bg-card border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">
            Error Details:
          </h3>
          <pre className="text-xs text-destructive bg-muted/50 p-3 rounded border overflow-auto max-h-32">
            {errorMessage}
          </pre>
        </div>

        <Button
          onClick={resetErrorBoundary}
          className="w-full"
          variant="outline"
        >
          <ArrowClockwiseIcon />
          Try Again
        </Button>
      </div>
    </div>
  );
};
