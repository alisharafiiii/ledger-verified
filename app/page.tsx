"use client";

import { useEffect, useState } from "react";
import BadgeDownloads from "@/components/BadgeDownloads";
import type { Platform } from "@/lib/handle";
import type { Transport } from "@/lib/ledger";

type Step = "idle" | "nonce" | "sign" | "verify" | "done" | "error";

const THEME = {
  x: { accent: "#ff7900", accentSoft: "rgba(255,121,0,0.15)" },
  linkedin: { accent: "#0a66c2", accentSoft: "rgba(10,102,194,0.18)" },
} as const;

export default function Home() {
  const [platform, setPlatform] = useState<Platform>("x");
  const [handle, setHandle] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<{ platform: Platform; handle: string; url: string } | null>(null);
  const [transport, setTransport] = useState<Transport>("webhid");
  const [defaultTransport, setDefaultTransport] = useState<Transport>("webhid");
  const [stats, setStats] = useState<{ visits: number; secured: number } | null>(null);

  const accent = THEME[platform].accent;
  const accentSoft = THEME[platform].accentSoft;

  useEffect(() => {
    import("@/lib/ledger").then(({ pickTransport }) => {
      const t = pickTransport();
      setDefaultTransport(t);
      setTransport(t);
    });
    // bump visits + load stats once
    fetch("/api/stats", { method: "POST" })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (badge) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [badge]);

  async function run() {
    setError(null);
    setBadge(null);
    try {
      setStep("nonce");
      const nonceRes = await fetch("/api/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, platform }),
      });
      const nonceJson = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceJson.error || "nonce failed");
      const message = nonceJson.message;

      setStep("sign");
      const { signLvMessageInBrowser } = await import("@/lib/ledger");
      const { signature } = await signLvMessageInBrowser(message, transport);

      setStep("verify");
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyJson.error || "verify failed");

      setBadge({
        platform: verifyJson.platform,
        handle: verifyJson.handle,
        url: verifyJson.badgeUrl,
      });
      setStep("done");
      // refresh stats so the count bumps live
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    } catch (e: any) {
      setError(e?.message || String(e));
      setStep("error");
    }
  }

  const busy = step === "nonce" || step === "sign" || step === "verify";

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full">
          <div
            className="mb-2 text-xs tracking-[0.3em] transition-colors"
            style={{ color: accent }}
          >
            ledger · secured
          </div>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            hardware-anchored
            <br />
            identity <span aria-hidden>🔐</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/60">
            {platform === "x" ? "twitter" : "linkedin"} doesn't decide who's real. your device does.
          </p>

          {/* platform picker */}
          <div className="mt-8 grid grid-cols-2 gap-2 rounded-xl border border-line bg-panel/40 p-1 text-xs">
            <PlatformBtn
              active={platform === "x"}
              onClick={() => setPlatform("x")}
              accent={THEME.x.accent}
              accentSoft={THEME.x.accentSoft}
              icon={<XLogo />}
              label="twitter"
            />
            <PlatformBtn
              active={platform === "linkedin"}
              onClick={() => setPlatform("linkedin")}
              accent={THEME.linkedin.accent}
              accentSoft={THEME.linkedin.accentSoft}
              icon={<LinkedinLogo />}
              label="linkedin"
            />
          </div>

          {/* transport picker */}
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-panel/40 p-1 text-xs">
            <TransportBtn
              active={transport === "webhid"}
              onClick={() => setTransport("webhid")}
              disabled={defaultTransport !== "webhid"}
              accent={accent}
              accentSoft={accentSoft}
              label="🔌 device direct"
            />
            <TransportBtn
              active={transport === "ledger-wallet"}
              onClick={() => setTransport("ledger-wallet")}
              accent={accent}
              accentSoft={accentSoft}
              label="📱 ledger wallet"
            />
          </div>
          {/* handle input */}
          <div
            className="mt-6 rounded-2xl border border-line bg-panel/60 p-5 backdrop-blur transition-shadow"
            style={{ boxShadow: `0 0 0 1px ${accentSoft}, 0 0 32px ${accentSoft}` }}
          >
            <label className="block text-xs text-white/50">
              {platform === "x" ? "x handle" : "linkedin slug"}
            </label>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-white/40">
                {platform === "x" ? "@" : "in/"}
              </span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={platform === "x" ? "yourhandle" : "your-name"}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-transparent text-lg outline-none placeholder:text-white/20"
                disabled={busy}
              />
            </div>
          </div>

          <button
            onClick={run}
            disabled={busy || handle.trim().length === 0}
            className="mt-5 w-full rounded-xl border px-6 py-4 text-sm tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: accent,
              color: accent,
              backgroundColor: accentSoft,
            }}
          >
            {step === "idle" &&
              (transport === "webhid"
                ? "secure with ledger device"
                : "secure with ledger wallet")}
            {step === "nonce" && "preparing message…"}
            {step === "sign" &&
              (transport === "webhid"
                ? "tap approve on your ledger…"
                : "open ledger wallet + approve…")}
            {step === "verify" && "recovering signer…"}
            {step === "done" && "secured 🔐"}
            {step === "error" && "try again"}
          </button>

          {error && (
            <div
              className="mt-4 rounded-lg border p-3 text-xs preserve-case"
              style={{ borderColor: accent, color: accent, backgroundColor: accentSoft }}
            >
              {error}
            </div>
          )}

          {stats && (stats.visits > 0 || stats.secured > 0) && (
            <footer className="mt-16 flex items-center justify-center gap-4 text-[11px] text-white/40">
              <span>
                <span style={{ color: accent }}>{stats.secured.toLocaleString()}</span>{" "}
                handles secured
              </span>
              <span className="text-white/20">·</span>
              <span>
                <span style={{ color: accent }}>{stats.visits.toLocaleString()}</span>{" "}
                visits
              </span>
            </footer>
          )}
        </div>
      </main>

      {badge && <BadgeReveal badge={badge} accent={accent} onClose={() => setBadge(null)} />}
    </>
  );
}

function PlatformBtn({
  active, onClick, accent, accentSoft, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  accent: string;
  accentSoft: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition"
      style={
        active
          ? { backgroundColor: accentSoft, color: accent }
          : { color: "rgba(255,255,255,0.5)" }
      }
    >
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedinLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
      <path d="M20.452 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.356V9h3.414v1.561h.046c.476-.9 1.637-1.852 3.37-1.852 3.601 0 4.266 2.37 4.266 5.455v6.288zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.554V9h3.565v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TransportBtn({
  active, onClick, disabled, accent, accentSoft, label,
}: {
  active: boolean; onClick: () => void; disabled?: boolean;
  accent: string; accentSoft: string; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-40"
      style={
        active
          ? { backgroundColor: accentSoft, color: accent }
          : { color: "rgba(255,255,255,0.5)" }
      }
    >
      {label}
    </button>
  );
}

function BadgeReveal({
  badge, accent, onClose,
}: {
  badge: { platform: Platform; handle: string; url: string };
  accent: string;
  onClose: () => void;
}) {
  const [linksOpen, setLinksOpen] = useState(false);
  const verifyUrl = `${origin()}${badge.url}`;
  const badgeUrl = `${origin()}/api/badge/${badge.platform}/${badge.handle}`;
  const xPost = `@${badge.handle} is ledger secured 🔐\n${verifyUrl}`;

  return (
    <div className="lv-overlay fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur-md">
      <button
        onClick={onClose}
        aria-label="close"
        className="absolute right-5 top-5 z-10 rounded-md border border-line bg-panel/60 px-3 py-1 text-xs text-white/60 hover:text-white"
        style={{ borderColor: accent + "55" }}
      >
        close ✕
      </button>

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 py-12">
        <div
          className="lv-stagger-1 mb-2 text-xs tracking-[0.3em]"
          style={{ color: accent }}
        >
          {badge.platform} · ledger · secured
        </div>
        <h2 className="lv-stagger-1 text-2xl text-center md:text-3xl">
          @{badge.handle} is secured 🔐
        </h2>

        <div
          className="lv-card lv-scan-wrap mt-8 w-full overflow-hidden rounded-2xl border"
          style={{ borderColor: accent + "66" }}
        >
          <img
            src={`/api/badge/${badge.platform}/${badge.handle}`}
            alt={`@${badge.handle} ledger secured badge`}
            className="block w-full"
          />
        </div>

        <div className="lv-stagger-2 mt-5 w-full">
          <BadgeDownloads platform={badge.platform} handle={badge.handle} />
        </div>

        <div className="lv-stagger-3 mt-4 w-full">
          <button
            type="button"
            onClick={() => setLinksOpen((v) => !v)}
            aria-expanded={linksOpen}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-panel/40 px-3 py-2 text-xs text-white/60 transition hover:text-white"
          >
            <span>share links</span>
            <span
              className={`transition-transform ${linksOpen ? "rotate-180" : "rotate-0"}`}
              aria-hidden
            >
              ▾
            </span>
          </button>

          {linksOpen && (
            <div className="lv-overlay mt-2 grid gap-2 text-xs">
              <CopyRow label="verify page" value={verifyUrl} />
              <CopyRow label="badge image" value={badgeUrl} />
              <CopyRow label="x post" value={xPost} />
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="lv-stagger-3 mt-10 text-xs"
          style={{ color: accent }}
        >
          ← back to home
        </button>
      </div>
    </div>
  );
}

function origin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "";
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-white/40">{label}</div>
        <div className="truncate text-white/80 preserve-case">{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-line bg-panel/40 px-3 py-1.5 text-white/70 transition hover:text-white"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </div>
  );
}
