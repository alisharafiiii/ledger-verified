import { NextResponse } from "next/server";
import { normalizeHandle } from "@/lib/handle";

export const runtime = "nodejs";
export const revalidate = 3600; // cache for an hour

// fetches a user's x avatar via unavatar.io (no oauth, no api key) and proxies
// the bytes back. lets the badge svg embed `/api/pfp/{handle}` directly,
// avoids exposing the unavatar url, and keeps cors/cache controlled by us.
export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  const handle = normalizeHandle(params.handle);
  if (!handle) return new NextResponse("invalid handle", { status: 400 });
  try {
    const upstream = await fetch(`https://unavatar.io/twitter/${handle}`, {
      next: { revalidate: 3600 },
    });
    if (!upstream.ok) return new NextResponse("pfp fetch failed", { status: 502 });
    const buf = await upstream.arrayBuffer();
    const ct = upstream.headers.get("content-type") || "image/png";
    return new NextResponse(buf, {
      headers: {
        "content-type": ct,
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return new NextResponse("pfp fetch error", { status: 500 });
  }
}
