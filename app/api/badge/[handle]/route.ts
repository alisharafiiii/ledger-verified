import { NextResponse } from "next/server";
import { getVerified } from "@/lib/redis";
import { normalizeHandle } from "@/lib/handle";
import { fetchPfpAsDataUri } from "@/lib/pfp";

export const runtime = "nodejs";

const ORANGE = "#ff7900";
const INK = "#05060a";
const PANEL = "#0a0c14";
const LINE = "#1a1d28";
const MUTED = "#8a93a6";

// returns an svg badge for the given handle.
// only public fields: handle + verified date + a short opaque serial.
// no address, no signature, no pubkey — privacy is enforced here.
export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  const handle = normalizeHandle(params.handle);
  if (!handle) return new NextResponse("invalid handle", { status: 400 });
  const rec = await getVerified(handle).catch(() => null);
  if (!rec) return new NextResponse("not verified", { status: 404 });
  const date = new Date(rec.timestamp).toISOString().slice(0, 10);

  // last 6 chars of the nonce → opaque serial that doesn't reveal anything sensitive
  const serial = `#${rec.nonce.slice(-6).toUpperCase()}`;

  // fetch pfp as base64 so the svg works as a standalone download
  const pfpDataUri = await fetchPfpAsDataUri(handle);

  const svg = renderBadgeSvg({ handle, date, serial, pfpDataUri });

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}

function renderBadgeSvg(opts: {
  handle: string;
  date: string;
  serial: string;
  pfpDataUri: string | null;
}): string {
  const { handle, date, serial, pfpDataUri } = opts;
  const handleEsc = escapeXml(handle);
  const dateEsc = escapeXml(date);
  const serialEsc = escapeXml(serial);

  // pfp circle on the right. if no pfp available, fall back to first-letter monogram.
  const pfpInner = pfpDataUri
    ? `<defs><clipPath id="pfpClip"><circle r="50"/></clipPath></defs>
       <image href="${pfpDataUri}" x="-50" y="-50" width="100" height="100" clip-path="url(#pfpClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<text text-anchor="middle" dy="18" font-size="56" fill="${ORANGE}" font-family="ui-monospace, Menlo, monospace">${handleEsc.charAt(0)}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 680 380" role="img">
<title>${handleEsc} — ledger secured</title>
<desc>terminal-style badge confirming @${handleEsc} signed a hardware-backed verification on ${dateEsc}</desc>
<rect width="680" height="380" rx="20" fill="${INK}"/>
<rect x="1" y="1" width="678" height="378" rx="19" fill="none" stroke="${LINE}"/>
<rect x="40" y="50" width="4" height="34" fill="${ORANGE}"/>
<text x="56" y="64" font-size="13" fill="${ORANGE}" font-family="ui-monospace, Menlo, monospace" letter-spacing="3">LEDGER · SECURED</text>
<text x="56" y="82" font-size="11" fill="${MUTED}" font-family="ui-monospace, Menlo, monospace">// hardware-anchored identity</text>
<line x1="40" y1="104" x2="640" y2="104" stroke="${LINE}"/>
<g font-family="ui-monospace, Menlo, monospace" font-size="14">
  <text x="56" y="138" fill="${MUTED}">handle</text>
  <text x="180" y="138" fill="#ffffff">@${handleEsc}</text>
  <text x="56" y="166" fill="${MUTED}">status</text>
  <g transform="translate(180, 152)">
    <path d="M3 9 v-5 c0 -3 8 -3 8 0 v5" fill="none" stroke="${ORANGE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="0" y="9" width="14" height="10" rx="1.8" fill="${ORANGE}"/>
    <circle cx="7" cy="13.5" r="1.6" fill="${INK}"/>
    <rect x="6.3" y="14.4" width="1.4" height="3" fill="${INK}"/>
    <text x="22" y="17" font-size="14" fill="${ORANGE}" font-family="ui-monospace, Menlo, monospace">secured</text>
  </g>
  <text x="56" y="194" fill="${MUTED}">method</text>
  <text x="180" y="194" fill="#ffffff">hardware · eip-191</text>
  <text x="56" y="222" fill="${MUTED}">issued</text>
  <text x="180" y="222" fill="#ffffff">${dateEsc}</text>
  <text x="56" y="250" fill="${MUTED}">badge</text>
  <text x="180" y="250" fill="#ffffff">${serialEsc}</text>
</g>
<g transform="translate(540, 192)">
  <circle r="60" fill="none" stroke="${ORANGE}" stroke-width="0.5" opacity="0.2"/>
  <circle r="56" fill="none" stroke="${ORANGE}" stroke-width="0.5" opacity="0.35"/>
  <circle r="50" fill="${PANEL}" stroke="${ORANGE}" stroke-width="2"/>
  ${pfpInner}
  <g transform="translate(31, 31)">
    <circle r="16" fill="${INK}" stroke="${ORANGE}" stroke-width="1.5"/>
    <g transform="translate(-6, -6)">
      <path d="M2.5 7 v-4 c0 -2.5 7 -2.5 7 0 v4" fill="none" stroke="${ORANGE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="-0.5" y="7" width="13" height="9" rx="1.5" fill="${ORANGE}"/>
      <circle cx="6" cy="11" r="1.3" fill="${INK}"/>
      <rect x="5.4" y="11.7" width="1.2" height="2.6" fill="${INK}"/>
    </g>
  </g>
</g>
<text x="540" y="274" text-anchor="middle" font-size="11" fill="${MUTED}" font-family="ui-monospace, Menlo, monospace">@${handleEsc}</text>
<line x1="40" y1="296" x2="640" y2="296" stroke="${LINE}"/>
<text x="56" y="324" font-size="11" fill="${MUTED}" font-family="ui-monospace, Menlo, monospace" letter-spacing="2">// no x api · no oauth · just hardware sign</text>
</svg>`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}
