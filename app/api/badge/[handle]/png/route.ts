import { NextResponse } from "next/server";
import { getVerified } from "@/lib/redis";
import { normalizeHandle } from "@/lib/handle";
import { fetchPfpAsDataUri } from "@/lib/pfp";
import { renderBadgeSvg } from "@/lib/badgeSvg";

export const runtime = "nodejs";

// server-side svg → png via @resvg/resvg-js. lets users save the badge as a
// real png file on every browser/device — the previous client-side canvas
// approach was failing silently on safari and some mobile browsers because
// canvases that render an svg containing <image> get tainted.
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

  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svg, {
      // render at the svg's natural size (1200x675) — already retina-friendly
      fitTo: { mode: "width", value: 1200 },
      // monospace fallback for the field labels (resvg defaults to deja vu sans)
      font: { loadSystemFonts: true },
      background: "rgba(0, 0, 0, 0)",
    });
    const png = resvg.render().asPng();
    return new NextResponse(png, {
      headers: {
        "content-type": "image/png",
        "content-disposition": `inline; filename="ledger-secured-${handle}.png"`,
        "cache-control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (e: any) {
    console.error("[badge png render error]", e);
    return new NextResponse(`png render failed: ${e?.message || e}`, {
      status: 500,
    });
  }
}
