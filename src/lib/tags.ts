/** Tags keep their spelling, but identity ignores surrounding spaces and case. */
export function tagKey(tag: string): string {
  return tag.trim().normalize('NFC').toLowerCase();
}

export function hasTag(tags: readonly string[], tag: string): boolean {
  const key = tagKey(tag);
  return tags.some((value) => tagKey(value) === key);
}

export function uniqueTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tagKey(tag);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
