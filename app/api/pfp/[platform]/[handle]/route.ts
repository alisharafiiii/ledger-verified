import { NextResponse } from "next/server";
import { normalizeHandle, isPlatform } from "@/lib/handle";
import { unavatarUrl } from "@/lib/pfp";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: { platform: string; handle: string } }
) {
  if (!isPlatform(params.platform)) {
    return new NextResponse("invalid platform", { status: 400 });
  }
  const handle = normalizeHandle(params.handle, params.platform);
  if (!handle) return new NextResponse("invalid handle", { status: 400 });
  try {
    const upstream = await fetch(unavatarUrl(params.platform, handle), {
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
