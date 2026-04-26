// builds the eip-712 typed data the ledger device will display + sign.
// keep the schema minimal so the ledger screen is readable.

export const LV_DOMAIN = {
  name: "ledger verified",
  version: "1",
} as const;

export const LV_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
  ],
  Verification: [
    { name: "handle", type: "string" },
    { name: "issuedAt", type: "string" },
    { name: "nonce", type: "string" },
    { name: "statement", type: "string" },
  ],
} as const;

export type LvMessage = {
  handle: string;
  issuedAt: string; // ISO date (utc, day precision)
  nonce: string;    // hex
  statement: string;
};

export function buildMessage(handle: string): LvMessage {
  const issuedAt = new Date().toISOString().slice(0, 10);
  // 16 random bytes → 32-char hex (node 18+ has globalThis.crypto)
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  // ascii-only printable chars → ledger eth app shows the message in clear
  // text (any non-ascii char like middle-dot triggers hash-fallback display).
  const statement = [
    "== LEDGER SECURED ==",
    "",
    `handle: @${handle}`,
    `issued: ${issuedAt}`,
    `nonce:  ${nonce}`,
    "",
    "not who twitter says i am",
    "who my device says i am",
  ].join("\n");
  return { handle, issuedAt, nonce, statement };
}

export function buildTypedData(msg: LvMessage) {
  return {
    domain: LV_DOMAIN,
    primaryType: "Verification" as const,
    types: LV_TYPES,
    message: msg,
  };
}
