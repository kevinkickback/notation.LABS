/** Quota estimates are advisory and already include the existing library's usage. */
export async function storageWarning(
  requiredBytes = 0,
): Promise<string | undefined> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate)
    return undefined;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (usage === undefined || quota === undefined) return undefined;
    if (quota - usage < requiredBytes || usage > quota * 0.95)
      return 'Local storage is nearly full. Free up space if this transfer cannot finish.';
  } catch {
    // An unavailable estimate is not a reason to reject a valid backup.
  }
  return undefined;
}
