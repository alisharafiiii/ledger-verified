// builds the eip-191 personal_sign message that ledger displays.
// kept ascii-only and multi-line so the device renders it as text.

import type { Platform } from "./handle";

export type LvMessage = {
  platform: Platform;
  handle: string;
  issuedAt: string; // ISO date (utc, day precision)
  nonce: string;    // hex
  statement: string;
};

export function buildMessage(platform: Platform, handle: string): LvMessage {
  const issuedAt = new Date().toISOString().slice(0, 10);
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const platformLabel = platform === "x" ? "x" : "linkedin";
  const closing = platform === "x" ? "twitter" : "linkedin";
  const statement = [
    "== LEDGER SECURED ==",
    "",
    `platform: ${platformLabel}`,
    `handle:   @${handle}`,
    `issued:   ${issuedAt}`,
    `nonce:    ${nonce}`,
    "",
    `not who ${closing} says i am`,
    "who my device says i am",
  ].join("\n");
  return { platform, handle, issuedAt, nonce, statement };
}
