import { ImageResponse } from "next/og";
import { getVerified } from "@/lib/redis";
import { normalizeHandle, isPlatform, type Platform } from "@/lib/handle";

export const runtime = "nodejs";

const THEMES: Record<Platform, {
  accent: string; ink: string; panel: string; line: string;
  muted: string; text: string; label: string;
}> = {
  x: {
    accent: "#ff7900", ink: "#05060a", panel: "#0a0c14",
    line: "#1a1d28", muted: "#8a93a6", text: "#ffffff", label: "X",
  },
  linkedin: {
    accent: "#0a66c2", ink: "#ffffff", panel: "#f3f6fb",
    line: "#dde3ec", muted: "#5a6a83", text: "#0a1a2f", label: "LINKEDIN",
  },
};

export async function GET(
  req: Request,
  { params }: { params: { platform: string; handle: string } }
) {
  if (!isPlatform(params.platform)) return new Response("invalid platform", { status: 400 });
  const handle = normalizeHandle(params.handle, params.platform);
  if (!handle) return new Response("invalid handle", { status: 400 });
  const rec = await getVerified(params.platform, handle).catch(() => null);
  if (!rec) return new Response("not secured", { status: 404 });

  const date = new Date(rec.timestamp).toISOString().slice(0, 10);
  const serial = `#${rec.nonce.slice(-6).toUpperCase()}`;
  const t = THEMES[params.platform];
  const origin = new URL(req.url).origin;
  const pfpUrl = `${origin}/api/pfp/${params.platform}/${handle}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: t.ink,
          padding: "60px 80px",
          display: "flex",
          flexDirection: "column",
          fontFamily: "monospace",
          color: t.text,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "6px", height: "48px", background: t.accent }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "22px", color: t.accent, letterSpacing: "6px" }}>
              {t.label} · LEDGER · SECURED
            </div>
            <div style={{ fontSize: "18px", color: t.muted, marginTop: "4px" }}>
              // hardware-anchored identity
            </div>
          </div>
        </div>

        <div style={{ height: "1px", background: t.line, marginTop: "40px" }} />

        <div style={{ display: "flex", marginTop: "40px", gap: "40px" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", fontSize: "26px" }}>
            <Row label="handle" value={`@${handle}`} t={t} />
            <Row label="status" value="secured" valueColor={t.accent} t={t} />
            <Row label="method" value="hardware · eip-191" t={t} />
            <Row label="issued" value={date} t={t} />
            <Row label="badge" value={serial} t={t} />
          </div>
          <div
            style={{
              width: "260px", height: "260px", borderRadius: "50%",
              background: t.panel, border: `3px solid ${t.accent}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", position: "relative",
            }}
          >
            <img src={pfpUrl} width={254} height={254} style={{ borderRadius: "50%", objectFit: "cover" }} />
          </div>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ height: "1px", background: t.line }} />
        <div style={{ marginTop: "16px", fontSize: "18px", color: t.muted, letterSpacing: "3px" }}>
          // no api · no oauth · just hardware sign
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

function Row({
  label, value, valueColor, t,
}: {
  label: string; value: string; valueColor?: string;
  t: { muted: string; text: string };
}) {
  return (
    <div style={{ display: "flex", gap: "32px" }}>
      <div style={{ width: "120px", color: t.muted }}>{label}</div>
      <div style={{ color: valueColor || t.text }}>{value}</div>
    </div>
  );
}
