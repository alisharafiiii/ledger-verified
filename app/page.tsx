"use client";

import { useEffect, useState } from "react";
import BadgeDownloads from "@/components/BadgeDownloads";
import type { Transport } from "@/lib/ledger";

type Step = "idle" | "nonce" | "sign" | "verify" | "done" | "error";

export default function Home() {
  const [handle, setHandle] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<{ handle: string; url: string } | null>(null);
  const [transport, setTransport] = useState<Transport>("webhid");
  const [defaultTransport, setDefaultTransport] = useState<Transport>("webhid");

  useEffect(() => {
    // pick the best transport for this device on mount
    import("@/lib/ledger").then(({ pickTransport }) => {
      const t = pickTransport();
      setDefaultTransport(t);
      setTransport(t);
    });
  }, []);

  // lock the body scroll while the reveal overlay is up
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
      // 1) ask backend for a fresh nonce + message
      setStep("nonce");
      const nonceRes = await fetch("/api/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const nonceJson = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceJson.error || "nonce failed");
      const message = nonceJson.message;

      // 2) sign in the browser — webhid on desktop chromium, ledger live elsewhere
      setStep("sign");
      const { signLvMessageInBrowser } = await import("@/lib/ledger");
      const { signature } = await signLvMessageInBrowser(message, transport);

      // 3) backend recovers signer + stores
      setStep("verify");
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyJson.error || "verify failed");

      setBadge({ handle: verifyJson.handle, url: verifyJson.badgeUrl });
      setStep("done");
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
          <div className="mb-2 text-xs tracking-[0.3em] text-neon">ledger · secured</div>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            hardware-anchored
            <br />
            identity <span aria-hidden>🔐</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/60">
            one handle. one device tap. one badge. nothing public except a lock.
          </p>

          {/* transport picker — webhid on desktop chromium, ledger live elsewhere */}
          <div className="mt-8 grid grid-cols-2 gap-2 rounded-xl border border-line bg-panel/40 p-1 text-xs">
            <button
              onClick={() => setTransport("webhid")}
              disabled={defaultTransport !== "webhid"}
              className={`rounded-lg px-3 py-2 transition ${
                transport === "webhid"
                  ? "bg-neon/15 text-neon"
                  : "text-white/50 hover:text-white/80"
              } disabled:cursor-not-allowed disabled:opacity-40`}
              title={defaultTransport !== "webhid" ? "webhid not supported on this browser/device" : ""}
            >
              🔌 device direct
            </button>
            <button
              onClick={() => setTransport("ledger-live")}
              className={`rounded-lg px-3 py-2 transition ${
                transport === "ledger-live"
                  ? "bg-neon/15 text-neon"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              📱 ledger live
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            {transport === "webhid"
              ? "plug your ledger in via usb. chrome / edge / brave / arc on desktop."
              : "scan a qr code with ledger live mobile to sign — works on any browser, any device."}
          </p>

          <div className="mt-6 rounded-2xl border border-line bg-panel/60 p-5 shadow-neon backdrop-blur">
            <label className="block text-xs text-white/50">x handle</label>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-white/40">@</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="yourhandle"
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
            className="mt-5 w-full rounded-xl border border-neon/50 bg-neon/10 px-6 py-4 text-sm tracking-widest text-neon transition hover:bg-neon/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {step === "idle" &&
              (transport === "webhid"
                ? "secure with ledger device"
                : "secure with ledger live")}
            {step === "nonce" && "preparing message…"}
            {step === "sign" &&
              (transport === "webhid"
                ? "tap approve on your ledger…"
                : "open ledger live + approve…")}
            {step === "verify" && "recovering signer…"}
            {step === "done" && "secured 🔐"}
            {step === "error" && "try again"}
          </button>

          {error && (
            <div className="mt-4 rounded-lg border border-neonOrange/40 bg-neonOrange/5 p-3 text-xs text-neonOrange preserve-case">
              {error}
            </div>
          )}

          <footer className="mt-16 text-[11px] text-white/30">
            no x api · no oauth · no backend signer · device → browser → lock.
          </footer>
        </div>
      </main>

      {badge && <BadgeReveal badge={badge} onClose={() => setBadge(null)} />}
    </>
  );
}

function BadgeReveal({
  badge,
  onClose,
}: {
  badge: { handle: string; url: string };
  onClose: () => void;
}) {
  const verifyUrl = `${origin()}${badge.url}`;
  const badgeUrl = `${origin()}/api/badge/${badge.handle}`;
  const xPost = `@${badge.handle} is ledger secured 🔐\n${verifyUrl}`;

  return (
    <div className="lv-overlay fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur-md">
      {/* close button */}
      <button
        onClick={onClose}
        aria-label="close"
        className="absolute right-5 top-5 z-10 rounded-md border border-line bg-panel/60 px-3 py-1 text-xs text-white/60 hover:border-neon/60 hover:text-neon"
      >
        close ✕
      </button>

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 py-12">
        {/* eyebrow */}
        <div className="lv-stagger-1 mb-2 text-xs tracking-[0.3em] text-neon">
          ledger · secured
        </div>
        <h2 className="lv-stagger-1 text-2xl text-center md:text-3xl">
          @{badge.handle} is secured 🔐
        </h2>

        {/* badge — main hero */}
        <div className="lv-card lv-scan-wrap mt-8 w-full overflow-hidden rounded-2xl border border-neon/40">
          <img
            src={`/api/badge/${badge.handle}`}
            alt={`@${badge.handle} ledger secured badge`}
            className="block w-full"
          />
        </div>

        {/* downloads */}
        <div className="lv-stagger-2 mt-5 w-full">
          <BadgeDownloads handle={badge.handle} />
        </div>

        {/* copy rows */}
        <div className="lv-stagger-3 mt-4 grid w-full gap-2 text-xs">
          <CopyRow label="verify page" value={verifyUrl} />
          <CopyRow label="badge image" value={badgeUrl} />
          <CopyRow label="x post" value={xPost} />
        </div>

        {/* dismiss link */}
        <button
          onClick={onClose}
          className="lv-stagger-3 mt-10 text-xs text-white/40 hover:text-neon"
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
    } catch {
      /* noop */
    }
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-white/40">{label}</div>
        <div className="truncate text-white/80 preserve-case">{value}</div>
      </div>
      <button
        onClick={copy}
        className="shrink-0 rounded-md border border-line bg-panel/40 px-3 py-1.5 text-white/70 transition hover:border-neon/60 hover:text-neon"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </div>
  );
}
