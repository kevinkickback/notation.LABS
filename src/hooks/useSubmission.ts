import { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface SubmissionCallbacks<T> {
  onSuccess: (value: T) => void;
  onError: (error: unknown) => void;
}

/** Writes continue after closing; their completion can only change the original editor. */
export function useSubmission(open: boolean, sessionKey = '') {
  const sessionRef = useRef({ active: false });
  const busyRef = useRef(false);
  const [pending, setPending] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Entity identity starts a new editor session.
  useLayoutEffect(() => {
    const session = { active: open };
    sessionRef.current = session;
    setPending(busyRef.current);
    return () => {
      session.active = false;
    };
  }, [open, sessionKey]);

  const submit = useCallback(
    async <T>(save: () => Promise<T>, callbacks: SubmissionCallbacks<T>) => {
      const session = sessionRef.current;
      if (!session.active || busyRef.current) return;
      busyRef.current = true;
      setPending(true);
      const current = () => session.active && sessionRef.current === session;
      try {
        const value = await save();
        if (current()) callbacks.onSuccess(value);
      } catch (error) {
        // Persisted writes must still report failures after their editor closes.
        callbacks.onError(error);
      } finally {
        busyRef.current = false;
        if (sessionRef.current.active) setPending(false);
      }
    },
    [],
  );

  return { pending, submit };
}
