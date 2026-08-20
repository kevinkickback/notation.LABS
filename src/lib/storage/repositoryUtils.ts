export function generateId(): string {
  return crypto.randomUUID();
}

export function toUniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
