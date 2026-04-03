/**
 * Converts unknown thrown values into a user-safe error message.
 */
export function toUserMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
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
