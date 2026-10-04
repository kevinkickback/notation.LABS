/**
 * Converts unknown thrown values into a user-safe error message.
 */
export function toUserMessage(err: unknown): string {
  const known =
    err instanceof Error ||
    (typeof DOMException !== 'undefined' && err instanceof DOMException);
  if (known && err.name === 'QuotaExceededError')
    return 'Local storage is full. Free up space and retry. Browser storage can be smaller in a private window; use a regular window or the desktop app for larger libraries.';
  if (known && err.message.trim().length > 0) {
    return err.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Reports an error with context for diagnostics.
 */
export function reportError(context: string, err: unknown): void {
  console.error(`[${context}]`, err);
}
