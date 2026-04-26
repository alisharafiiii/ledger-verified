import { ImageResponse } from "next/og";
import { getVerified } from "@/lib/redis";
import { normalizeHandle } from "@/lib/handle";

export const runtime = "nodejs";

const ORANGE = "#ff7900";
const INK = "#05060a";
const PANEL = "#0a0c14";
const LINE = "#1a1d28";
const MUTED = "#8a93a6";
const TEXT = "#ffffff";

// renders the badge as a 1200x630 png via next/og.
// social platforms (x, discord, telegram, slack) require png/jpg for
// preview cards — the svg badge is great as a downloadable image but
// won't render natively in tweet previews. this route bridges that gap.
export async function GET(
  req: Request,
  { params }: { params: { handle: string } }
) {
  const handle = normalizeHandle(params.handle);
  if (!handle) return new Response("invalid handle", { status: 400 });
  const rec = await getVerified(handle).catch(() => null);
  if (!rec) return new Response("not verified", { status: 404 });

  const date = new Date(rec.timestamp).toISOString().slice(0, 10);
  const serial = `#${rec.nonce.slice(-6).toUpperCase()}`;

  // build absolute pfp url so satori can fetch it
  const origin = new URL(req.url).origin;
  const pfpUrl = `${origin}/api/pfp/${handle}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: INK,
          padding: "60px 80px",
          display: "flex",
          flexDirection: "column",
          fontFamily: "monospace",
          color: TEXT,
          position: "relative",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "6px", height: "48px", background: ORANGE }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "22px", color: ORANGE, letterSpacing: "6px" }}>
              LEDGER · SECURED
            </div>
            <div style={{ fontSize: "18px", color: MUTED, marginTop: "4px" }}>
              // hardware-anchored identity
            </div>
          </div>
        </div>

        <div style={{ height: "1px", background: LINE, marginTop: "40px" }} />

        {/* body: fields left, pfp right */}
        <div style={{ display: "flex", marginTop: "40px", gap: "40px" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", fontSize: "26px" }}>
            <Row label="handle" value={`@${handle}`} />
            <Row label="status" value="🔐 secured" valueColor={ORANGE} />
            <Row label="method" value="hardware · eip-191" />
            <Row label="issued" value={date} />
            <Row label="badge" value={serial} />
          </div>
          <div
            style={{
              width: "260px",
              height: "260px",
              borderRadius: "50%",
              background: PANEL,
              border: `3px solid ${ORANGE}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <img
              src={pfpUrl}
              width={254}
              height={254}
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
            {/* lock satellite chip */}
            <div
              style={{
                position: "absolute",
                bottom: "12px",
                right: "12px",
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: INK,
                border: `3px solid ${ORANGE}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
              }}
            >
              🔐
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ height: "1px", background: LINE }} />
        <div style={{ marginTop: "16px", fontSize: "18px", color: MUTED, letterSpacing: "3px" }}>
          // no x api · no oauth · just hardware sign
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function Row({
  label,
  value,
  valueColor = TEXT,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", gap: "32px" }}>
      <div style={{ width: "120px", color: MUTED }}>{label}</div>
      <div style={{ color: valueColor }}>{value}</div>
    </div>
  );
}
