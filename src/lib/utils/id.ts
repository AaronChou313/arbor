export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function truncateTitle(value: string, max = 44): string {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
