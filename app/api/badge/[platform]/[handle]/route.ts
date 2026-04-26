import { NextResponse } from "next/server";
import { getVerified } from "@/lib/redis";
import { normalizeHandle, isPlatform } from "@/lib/handle";
import { fetchPfpAsDataUri } from "@/lib/pfp";
import { renderBadgeSvg } from "@/lib/badgeSvg";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { platform: string; handle: string } }
) {
  if (!isPlatform(params.platform)) {
    return new NextResponse("invalid platform", { status: 400 });
  }
  const handle = normalizeHandle(params.handle, params.platform);
  if (!handle) return new NextResponse("invalid handle", { status: 400 });
  const rec = await getVerified(params.platform, handle).catch(() => null);
  if (!rec) return new NextResponse("not secured", { status: 404 });
  const date = new Date(rec.timestamp).toISOString().slice(0, 10);
  const serial = `#${rec.nonce.slice(-6).toUpperCase()}`;
  const pfpDataUri = await fetchPfpAsDataUri(params.platform, handle);
  const svg = renderBadgeSvg({
    platform: params.platform,
    handle,
    date,
    serial,
    pfpDataUri,
  });
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}
