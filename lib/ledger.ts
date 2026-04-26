// browser-side signer with two transports:
//
//   1. desktop chromium with webhid → @ledgerhq/hw-app-eth direct
//      (one-tap, fastest, no extra modal)
//   2. everything else (mobile, safari, firefox, no-webhid) → ledger
//      connect-kit, which falls back to ledger live via walletconnect
//
// connect-kit handles the qr-code / deep-link flow into ledger live on
// mobile. desktop browsers without webhid get the same modal. ledger
// hosts the modal ui, no extra config needed.

"use client";

import { bytesToHex, toBytes } from "viem";
import type { LvMessage } from "./eip712";

const DEFAULT_PATH =
  process.env.NEXT_PUBLIC_LEDGER_DERIVATION_PATH || "44'/60'/0'/0/0";

export type SignResult = {
  signature: `0x${string}`; // r||s||v hex, 132 chars
};

export type Transport = "webhid" | "ledger-live";

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(
    navigator.userAgent
  );
}

// pick the transport: webhid wins on desktop chromium; otherwise ledger live
export function pickTransport(): Transport {
  if (!isMobile() && isWebHidSupported()) return "webhid";
  return "ledger-live";
}

export async function signLvMessageInBrowser(
  msg: LvMessage,
  transport: Transport = pickTransport()
): Promise<SignResult> {
  if (transport === "webhid") {
    return signViaWebHid(msg);
  }
  return signViaConnectKit(msg);
}

// ─── webhid path ────────────────────────────────────────────────────────────

async function signViaWebHid(msg: LvMessage): Promise<SignResult> {
  const [{ default: TransportWebHID }, { default: Eth }] = await Promise.all([
    import("@ledgerhq/hw-transport-webhid"),
    import("@ledgerhq/hw-app-eth"),
  ]);

  const transport = await TransportWebHID.create();
  try {
    const eth = new Eth(transport);
    const messageHex = bytesToHex(toBytes(msg.statement)).slice(2);
    const sig = await eth.signPersonalMessage(DEFAULT_PATH, messageHex);
    let v = sig.v.toString(16);
    if (v.length < 2) v = "0" + v;
    const signature = ("0x" +
      sig.r.padStart(64, "0") +
      sig.s.padStart(64, "0") +
      v) as `0x${string}`;
    return { signature };
  } catch (e: any) {
    console.error("[ledger webhid sign error]", e);
    throw new Error(e?.message || e?.statusText || "device sign failed");
  } finally {
    await transport.close().catch(() => {});
  }
}

// ─── ledger live / connect-kit path ─────────────────────────────────────────

let _provider: any | null = null;

async function getConnectKitProvider() {
  if (_provider) return _provider;
  const { loadConnectKit } = await import("@ledgerhq/connect-kit-loader");
  const connectKit = await loadConnectKit();
  // allow ethereum mainnet — chain id is used purely for transport routing
  // (we're signing a personal_sign, not sending a tx)
  connectKit.checkSupport({
    providerType: "Ethereum" as any,
    chainId: 1,
  });
  _provider = await connectKit.getProvider();
  return _provider;
}

async function signViaConnectKit(msg: LvMessage): Promise<SignResult> {
  try {
    const provider = await getConnectKitProvider();

    // request account access (opens ledger live deep-link / qr modal)
    const accounts: string[] = await provider.request({
      method: "eth_requestAccounts",
    });
    const account = accounts?.[0];
    if (!account) throw new Error("no account returned from ledger live");

    // personal_sign — message must be hex-encoded utf-8 bytes
    const messageHex = bytesToHex(toBytes(msg.statement));
    const signature: string = await provider.request({
      method: "personal_sign",
      params: [messageHex, account],
    });

    return { signature: signature as `0x${string}` };
  } catch (e: any) {
    console.error("[ledger live sign error]", e);
    throw new Error(
      e?.message || e?.shortMessage || "ledger live sign failed"
    );
  }
}
