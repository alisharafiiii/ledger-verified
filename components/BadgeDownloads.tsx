"use client";

import { useState } from "react";

type Status = "idle" | "working" | "done" | "error";

// three actions for the verified badge:
//   - download as png (server-rendered, real png bytes — works everywhere)
//   - download as svg (vector, sharp at any size)
//   - copy as png to the clipboard (paste straight into a tweet/discord)
//
// png + copy fetch from /api/badge/[handle]/png which uses @resvg/resvg-js
// server-side, so no browser canvas/cors quirks.
export default function BadgeDownloads({ handle }: { handle: string }) {
  const [pngState, setPngState] = useState<Status>("idle");
  const [svgState, setSvgState] = useState<Status>("idle");
  const [copyState, setCopyState] = useState<Status>("idle");

  const svgUrl = `/api/badge/${handle}`;
  const pngUrl = `/api/badge/${handle}/png`;

  async function fetchBlob(url: string, expect: string): Promise<Blob> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch ${url} ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith(expect)) {
      throw new Error(`unexpected content-type ${ct}`);
    }
    return await res.blob();
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function handlePng() {
    setPngState("working");
    try {
      const blob = await fetchBlob(pngUrl, "image/png");
      downloadBlob(blob, `ledger-secured-${handle}.png`);
      setPngState("done");
    } catch (e: any) {
      console.error("[png download error]", e);
      // fallback: at least give them the svg so they leave with something
      try {
        const text = await fetch(svgUrl, { cache: "no-store" }).then((r) =>
          r.text()
        );
        downloadBlob(
          new Blob([text], { type: "image/svg+xml" }),
          `ledger-secured-${handle}.svg`
        );
        setPngState("done");
      } catch (e2: any) {
        console.error("[svg fallback also failed]", e2);
        setPngState("error");
      }
    }
    setTimeout(() => setPngState("idle"), 1800);
  }

  async function handleSvg() {
    setSvgState("working");
    try {
      const text = await fetch(svgUrl, { cache: "no-store" }).then((r) =>
        r.text()
      );
      downloadBlob(
        new Blob([text], { type: "image/svg+xml" }),
        `ledger-secured-${handle}.svg`
      );
      setSvgState("done");
    } catch (e: any) {
      console.error("[svg download error]", e);
      setSvgState("error");
    }
    setTimeout(() => setSvgState("idle"), 1800);
  }

  async function handleCopy() {
    setCopyState("working");
    try {
      const blob = await fetchBlob(pngUrl, "image/png");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopyState("done");
    } catch (e: any) {
      console.error("[copy image error]", e);
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 1800);
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <Btn onClick={handlePng} state={pngState} label="download png" />
      <Btn onClick={handleSvg} state={svgState} label="download svg" />
      <Btn onClick={handleCopy} state={copyState} label="copy image" />
    </div>
  );
}

function Btn({
  onClick,
  state,
  label,
}: {
  onClick: () => void;
  state: Status;
  label: string;
}) {
  const text =
    state === "working"
      ? "…"
      : state === "done"
      ? "done ✓"
      : state === "error"
      ? "try again"
      : label;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "working"}
      className="rounded-md border border-line bg-ink/40 px-2 py-2 text-white/70 transition hover:border-neon/60 hover:text-neon disabled:opacity-50"
    >
      {text}
    </button>
  );
}
