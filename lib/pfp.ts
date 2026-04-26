// server-side helper to fetch an x avatar via unavatar and return it as a
// base64 data uri. used when embedding the pfp into a standalone svg badge
// (so the downloaded svg works without any external network calls).

export async function fetchPfpAsDataUri(handle: string): Promise<string | null> {
  try {
    const upstream = await fetch(`https://unavatar.io/twitter/${handle}`, {
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
