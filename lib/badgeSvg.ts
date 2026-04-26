// shared svg badge renderer — used by both /api/badge/[platform]/[handle]
// (svg) and /api/badge/[platform]/[handle]/png (server-rasterized via resvg).
// supports two themes:
//   x        → dark bg, ledger orange accents
//   linkedin → white bg, linkedin blue accents

import type { Platform } from "./handle";

type Theme = {
  accent: string;       // primary brand color
  ink: string;          // outer card bg
  panel: string;        // inset panel bg
  line: string;         // dividers / borders
  muted: string;        // secondary text
  text: string;         // primary text
  headerLabel: string;  // shown in the corner header
};

const THEMES: Record<Platform, Theme> = {
  x: {
    accent: "#ff7900",
    ink: "#05060a",
    panel: "#0a0c14",
    line: "#1a1d28",
    muted: "#8a93a6",
    text: "#ffffff",
    headerLabel: "X",
  },
  linkedin: {
    accent: "#0a66c2",
    ink: "#ffffff",
    panel: "#f3f6fb",
    line: "#dde3ec",
    muted: "#5a6a83",
    text: "#0a1a2f",
    headerLabel: "LINKEDIN",
  },
};

export function renderBadgeSvg(opts: {
  platform: Platform;
  handle: string;
  date: string;
  serial: string;
  pfpDataUri: string | null;
}): string {
  const { platform, handle, date, serial, pfpDataUri } = opts;
  const t = THEMES[platform];
  const handleEsc = escapeXml(handle);
  const dateEsc = escapeXml(date);
  const serialEsc = escapeXml(serial);

  const pfpInner = pfpDataUri
    ? `<defs><clipPath id="pfpClip"><circle r="50"/></clipPath></defs>
       <image href="${pfpDataUri}" x="-50" y="-50" width="100" height="100" clip-path="url(#pfpClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<text text-anchor="middle" dy="18" font-size="56" fill="${t.accent}" font-family="ui-monospace, Menlo, monospace">${handleEsc.charAt(0)}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="44 25 591 330" role="img">
<title>${handleEsc} — ledger secured</title>
<desc>terminal-style badge confirming @${handleEsc} on ${t.headerLabel.toLowerCase()} signed a hardware-backed verification on ${dateEsc}</desc>
<rect x="44" y="25" width="591" height="330" rx="17" fill="${t.ink}"/>
<rect x="45" y="26" width="589" height="328" rx="16" fill="none" stroke="${t.line}"/>
<rect x="56" y="50" width="4" height="34" fill="${t.accent}"/>
<text x="72" y="64" font-size="13" fill="${t.accent}" font-family="ui-monospace, Menlo, monospace" letter-spacing="3">${t.headerLabel} · LEDGER · SECURED</text>
<text x="72" y="82" font-size="11" fill="${t.muted}" font-family="ui-monospace, Menlo, monospace">// hardware-anchored identity</text>
<line x1="56" y1="104" x2="624" y2="104" stroke="${t.line}"/>
<g font-family="ui-monospace, Menlo, monospace" font-size="14">
  <text x="72" y="138" fill="${t.muted}">handle</text>
  <text x="180" y="138" fill="${t.text}">@${handleEsc}</text>
  <text x="72" y="166" fill="${t.muted}">status</text>
  <g transform="translate(180, 152)">
    <path d="M3 9 v-5 c0 -3 8 -3 8 0 v5" fill="none" stroke="${t.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="0" y="9" width="14" height="10" rx="1.8" fill="${t.accent}"/>
    <circle cx="7" cy="13.5" r="1.6" fill="${t.ink}"/>
    <rect x="6.3" y="14.4" width="1.4" height="3" fill="${t.ink}"/>
    <text x="22" y="17" font-size="14" fill="${t.accent}" font-family="ui-monospace, Menlo, monospace">secured</text>
  </g>
  <text x="72" y="194" fill="${t.muted}">method</text>
  <text x="180" y="194" fill="${t.text}">hardware · eip-191</text>
  <text x="72" y="222" fill="${t.muted}">issued</text>
  <text x="180" y="222" fill="${t.text}">${dateEsc}</text>
  <text x="72" y="250" fill="${t.muted}">badge</text>
  <text x="180" y="250" fill="${t.text}">${serialEsc}</text>
</g>
<g transform="translate(540, 190)">
  <circle r="60" fill="none" stroke="${t.accent}" stroke-width="0.5" opacity="0.2"/>
  <circle r="56" fill="none" stroke="${t.accent}" stroke-width="0.5" opacity="0.35"/>
  <circle r="50" fill="${t.panel}" stroke="${t.accent}" stroke-width="2"/>
  ${pfpInner}
  <g transform="translate(31, 31)">
    <circle r="16" fill="${t.ink}" stroke="${t.accent}" stroke-width="1.5"/>
    <g transform="translate(-6, -6)">
      <path d="M2.5 7 v-4 c0 -2.5 7 -2.5 7 0 v4" fill="none" stroke="${t.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="-0.5" y="7" width="13" height="9" rx="1.5" fill="${t.accent}"/>
      <circle cx="6" cy="11" r="1.3" fill="${t.ink}"/>
      <rect x="5.4" y="11.7" width="1.2" height="2.6" fill="${t.ink}"/>
    </g>
  </g>
</g>
<text x="540" y="272" text-anchor="middle" font-size="11" fill="${t.muted}" font-family="ui-monospace, Menlo, monospace">@${handleEsc}</text>
<line x1="56" y1="296" x2="624" y2="296" stroke="${t.line}"/>
<text x="72" y="324" font-size="11" fill="${t.muted}" font-family="ui-monospace, Menlo, monospace" letter-spacing="2">// no api · no oauth · just hardware sign</text>
</svg>`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}
