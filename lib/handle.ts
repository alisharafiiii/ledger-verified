// normalize an x handle: strip @, lowercase, validate basic shape
export function normalizeHandle(input: string): string | null {
  const trimmed = input.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(trimmed)) return null;
  return trimmed;
}
