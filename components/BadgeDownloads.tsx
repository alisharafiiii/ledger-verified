"use client";

import { useState } from "react";

type Status = "idle" | "working" | "done" | "error";

// three actions for the verified badge:
//  - download as png (1200x675, twitter-card-friendly)
//  - download as svg (vector, sharp at any size)
//  - copy as png to the clipboard (paste straight into a tweet/discord/etc)
//
// the png conversion is fully client-side via a <canvas> — no server round-trip,
// no extra deps. works in every modern browser.
export default function BadgeDownloads({ handle }: { handle: string }) {
  const [pngState, setPngState] = useState<Status>("idle");
  const [svgState, setSvgState] = useState<Status>("idle");
  const [copyState, setCopyState] = useState<Status>("idle");

  const svgUrl = `/api/badge/${handle}`;

  async function fetchSvgText(): Promise<string> {
    const res = await fetch(svgUrl);
    if (!res.ok) throw new Error("badge fetch failed");
    return await res.text();
  }

  async function svgToPngBlob(): Promise<Blob> {
    const svgText = await fetchSvgText();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 675;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      ctx.drawImage(img, 0, 0, 1200, 675);
      return await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handlePng() {
    setPngState("working");
    try {
      const blob = await svgToPngBlob();
      await downloadBlob(blob, `ledger-secured-${handle}.png`);
      setPngState("done");
      setTimeout(() => setPngState("idle"), 1800);
    } catch {
      setPngState("error");
      setTimeout(() => setPngState("idle"), 2400);
    }
  }

  async function handleSvg() {
    setSvgState("working");
    try {
      const text = await fetchSvgText();
      await downloadBlob(new Blob([text], { type: "image/svg+xml" }), `ledger-secured-${handle}.svg`);
      setSvgState("done");
      setTimeout(() => setSvgState("idle"), 1800);
    } catch {
      setSvgState("error");
      setTimeout(() => setSvgState("idle"), 2400);
    }
  }

  async function handleCopy() {
    setCopyState("working");
    try {
      const blob = await svgToPngBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyState("done");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2400);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <Btn onClick={handlePng} state={pngState} label="download png" />
      <Btn onClick={handleSvg} state={svgState} label="download svg" />
      <Btn onClick={handleCopy} state={copyState} label="copy image" />
    </div>
  );
}

function Btn({ onClick, state, label }: { onClick: () => void; state: Status; label: string }) {
  const text =
    state === "working" ? "…" : state === "done" ? "done ✓" : state === "error" ? "try again" : label;
  return (
    <button
      onClick={onClick}
      disabled={state === "working"}
      className="rounded-md border border-line bg-ink/40 px-2 py-2 text-white/70 transition hover:border-neon/60 hover:text-neon disabled:opacity-50"
    >
      {text}
    </button>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
