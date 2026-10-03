import { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface MediaCallbacks<T> {
  onSuccess: (value: T) => void;
  onError?: (error: unknown) => void;
  onDiscard?: (value: T) => void;
}

/** Owns media work for one editor session; superseded results never reach its UI. */
export function useMediaRequest(open: boolean, sessionKey = '') {
  const controllerRef = useRef<AbortController | null>(null);
  const activeRef = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPending(null);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Changing entity identity starts a new media session.
  useLayoutEffect(() => {
    activeRef.current = open;
    cancel();
    return () => {
      activeRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [open, sessionKey, cancel]);

  const run = useCallback(
    async <T>(
      label: string,
      load: (signal: AbortSignal) => Promise<T>,
      callbacks: MediaCallbacks<T>,
    ) => {
      if (!activeRef.current) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setPending(label);
      const current = () =>
        activeRef.current &&
        controllerRef.current === controller &&
        !controller.signal.aborted;
      try {
        const value = await load(controller.signal);
        if (current()) callbacks.onSuccess(value);
        else callbacks.onDiscard?.(value);
      } catch (error) {
        if (current()) callbacks.onError?.(error);
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setPending(null);
        }
      }
    },
    [],
  );

  return { pending, run, cancel };
}
