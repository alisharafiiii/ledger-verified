import { NextResponse } from "next/server";
import { getVerified } from "@/lib/redis";
import { normalizeHandle } from "@/lib/handle";
import { fetchPfpAsDataUri } from "@/lib/pfp";
import { renderBadgeSvg } from "@/lib/badgeSvg";

export const runtime = "nodejs";

// returns the svg badge for the given handle.
// only public fields: handle + verified date + opaque serial.
// no address, no signature, no pubkey.
export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  const handle = normalizeHandle(params.handle);
  if (!handle) return new NextResponse("invalid handle", { status: 400 });
  const rec = await getVerified(handle).catch(() => null);
  if (!rec) return new NextResponse("not verified", { status: 404 });
  const date = new Date(rec.timestamp).toISOString().slice(0, 10);
  const serial = `#${rec.nonce.slice(-6).toUpperCase()}`;
  const pfpDataUri = await fetchPfpAsDataUri(handle);
  const svg = renderBadgeSvg({ handle, date, serial, pfpDataUri });
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}
