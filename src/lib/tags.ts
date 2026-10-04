/** Tags keep their spelling, but identity ignores surrounding spaces and case. */
export function tagKey(tag: string): string {
  return tag.trim().normalize('NFC').toLowerCase();
}

const tagTones = [
  'blue',
  'teal',
  'green',
  'amber',
  'orange',
  'rose',
  'violet',
  'cyan',
] as const;

/** A tag keeps the same presentation color across views and spelling variants. */
export function getTagTone(tag: string): (typeof tagTones)[number] {
  let hash = 0;
  for (const character of tagKey(tag)) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return tagTones[hash % tagTones.length];
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
