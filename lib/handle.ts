// platform-aware handle normalization.

export type Platform = "x" | "linkedin";

export const PLATFORMS: Platform[] = ["x", "linkedin"];

export function isPlatform(p: any): p is Platform {
  return p === "x" || p === "linkedin";
}

// human label for a platform
export function platformLabel(p: Platform): string {
  return p === "x" ? "x" : "linkedin";
}

// strips @ + url prefix, lowercases, validates per-platform shape.
export function normalizeHandle(
  input: string,
  platform: Platform = "x"
): string | null {
  let trimmed = input.trim();
  // strip common url prefixes
  trimmed = trimmed.replace(
    /^https?:\/\/(www\.)?(twitter\.com\/|x\.com\/|linkedin\.com\/in\/)/i,
    ""
  );
  trimmed = trimmed.replace(/\/.*$/, ""); // drop anything after first slash
  trimmed = trimmed.replace(/^@+/, "").toLowerCase();
  if (platform === "x") {
    if (!/^[a-z0-9_]{1,15}$/.test(trimmed)) return null;
  } else {
    // linkedin slugs allow letters, numbers, hyphens, 3-100 chars
    if (!/^[a-z0-9-]{3,100}$/.test(trimmed)) return null;
  }
  return trimmed;
}
