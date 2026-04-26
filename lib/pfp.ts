// proxy + cache user profile pictures via unavatar.io.
// no oauth, no api key. unavatar mirrors public profile images and falls
// back to a generated placeholder when the source is unavailable.
//
// platform routing:
//   x        → unavatar.io/twitter/{handle}
//   linkedin → unavatar.io/linkedin/{handle}  (less reliable; linkedin
//              actively blocks scrapers — we accept the fallback gracefully)

import type { Platform } from "./handle";

export function unavatarUrl(platform: Platform, handle: string): string {
  if (platform === "x") return `https://unavatar.io/twitter/${handle}`;
  return `https://unavatar.io/linkedin/${handle}`;
}

export async function fetchPfpAsDataUri(
  platform: Platform,
  handle: string
): Promise<string | null> {
  try {
    const upstream = await fetch(unavatarUrl(platform, handle), {
      next: { revalidate: 3600 },
    });
    if (!upstream.ok) return null;
    const buf = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get("content-type") || "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
