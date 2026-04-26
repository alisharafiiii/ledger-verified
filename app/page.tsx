"use client";

import { useEffect, useState } from "react";
import BadgeDownloads from "@/components/BadgeDownloads";

type Step = "idle" | "nonce" | "sign" | "verify" | "done" | "error";

export default function Home() {
  const [handle, setHandle] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<{ handle: string; url: string } | null>(null);
  const [hidOk, setHidOk] = useState<boolean | null>(null);

  useEffect(() => {
    setHidOk(typeof navigator !== "undefined" && "hid" in navigator);
  }, []);

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

      // 2) sign in the browser via webhid (user taps approve on device)
      setStep("sign");
      const { signLvMessageInBrowser } = await import("@/lib/ledger");
      const { signature } = await signLvMessageInBrowser(message);

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

        {hidOk === false && (
          <div className="mt-6 rounded-lg border border-neonOrange/40 bg-neonOrange/5 p-3 text-xs text-neonOrange">
            this browser doesn't support webhid. open in chrome, edge, brave, or arc on desktop.
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-line bg-panel/60 p-5 shadow-neon backdrop-blur">
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
          disabled={busy || handle.trim().length === 0 || hidOk === false}
          className="mt-5 w-full rounded-xl border border-neon/50 bg-neon/10 px-6 py-4 text-sm tracking-widest text-neon transition hover:bg-neon/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {step === "idle" && "verify with ledger"}
          {step === "nonce" && "preparing message…"}
          {step === "sign" && "tap approve on your ledger…"}
          {step === "verify" && "recovering signer…"}
          {step === "done" && "secured 🔐"}
          {step === "error" && "try again"}
        </button>

        {error && (
          <div className="mt-4 rounded-lg border border-neonOrange/40 bg-neonOrange/5 p-3 text-xs text-neonOrange preserve-case">
            {error}
          </div>
        )}

        {badge && (
          <div className="mt-8 rounded-2xl border border-line bg-panel/60 p-5">
            <div className="text-xs text-white/50">your badge</div>
            <div className="mt-3">
              <img
                src={`/api/badge/${badge.handle}`}
                alt="ledger secured badge"
                className="w-full rounded-lg border border-line"
              />
            </div>
            <div className="mt-4">
              <BadgeDownloads handle={badge.handle} />
            </div>
            <div className="mt-4 grid gap-2 text-xs">
              <CopyRow label="verify page" value={`${origin()}${badge.url}`} />
              <CopyRow label="badge image" value={`${origin()}/api/badge/${badge.handle}`} />
              <CopyRow
                label="x post"
                value={`@${badge.handle} is ledger secured 🔐\n${origin()}${badge.url}`}
              />
            </div>
          </div>
        )}

        <footer className="mt-16 text-[11px] text-white/30">
          no x api · no oauth · no backend signer · device → browser → lock.
        </footer>
      </div>
    </main>
  );
}

function origin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "";
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-white/40">{label}</div>
        <div className="truncate text-white/80 preserve-case">{value}</div>
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="shrink-0 rounded-md border border-line px-2 py-1 text-white/60 hover:text-neon"
      >
        copy
      </button>
    </div>
  );
}
