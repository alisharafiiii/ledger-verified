// browser-only signer using the legacy-but-rock-solid ledger stack:
//   @ledgerhq/hw-transport-webhid  — webhid transport
//   @ledgerhq/hw-app-eth            — minimal ethereum apdu wrapper
//
// the newer "device-management-kit" stack has a context-module that tries
// to fetch clear-sign metadata from ledger's crypto-asset-list service for
// every signing request — which throws "unknown favcoin" / "unexpected
// device exchange" errors for any custom dapp that isn't whitelisted in
// their cal. hw-app-eth has none of that surface area: it sends raw
// personal_sign apdus and gets back r/s/v.
//
// this is the same path used by rabby, rainbow, frame, and most production
// dapps that talk to ledger devices.

"use client";

import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import Eth from "@ledgerhq/hw-app-eth";
import { bytesToHex, toBytes } from "viem";

import type { LvMessage } from "./eip712";

const DEFAULT_PATH =
  process.env.NEXT_PUBLIC_LEDGER_DERIVATION_PATH || "44'/60'/0'/0/0";

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export type SignResult = {
  signature: `0x${string}`; // r||s||v hex, 132 chars
};

export async function signLvMessageInBrowser(
  msg: LvMessage
): Promise<SignResult> {
  if (!isWebHidSupported()) {
    throw new Error(
      "webhid not available — use chrome, edge, brave, or arc on desktop."
    );
  }

  // first call triggers the browser's hid permission prompt; subsequent
  // calls reuse the granted device automatically.
  const transport = await TransportWebHID.create();

  try {
    const eth = new Eth(transport);

    // hw-app-eth's signPersonalMessage takes the message as a hex string of
    // its utf-8 bytes (no 0x prefix). it handles the eip-191 prefix
    // (\x19Ethereum Signed Message:\n{len}) for us internally.
    const messageHex = bytesToHex(toBytes(msg.statement)).slice(2);

    const sig = await eth.signPersonalMessage(DEFAULT_PATH, messageHex);

    // sig has shape { r: hex (no 0x), s: hex (no 0x), v: number }
    let v = sig.v.toString(16);
    if (v.length < 2) v = "0" + v;

    const signature = ("0x" +
      sig.r.padStart(64, "0") +
      sig.s.padStart(64, "0") +
      v) as `0x${string}`;

    return { signature };
  } catch (e: any) {
    // surface a useful message to the ui
    const detail =
      e?.message || e?.statusText || e?.name || "device sign failed";
    console.error("[ledger sign error]", e);
    throw new Error(detail);
  } finally {
    await transport.close().catch(() => {});
  }
}
