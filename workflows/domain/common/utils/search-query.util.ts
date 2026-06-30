export function normalizeSearch(search: string | undefined): string {
  return String(search ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function escapePostgrestPattern(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_').replaceAll(',', '\\,');
}
