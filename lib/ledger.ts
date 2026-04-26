// browser-side signer with two transports:
//
//   1. desktop chromium with webhid → @ledgerhq/hw-app-eth direct
//      (one-tap, fastest, no extra modal)
//   2. everything else (mobile, safari, firefox, no-webhid) →
//      walletconnect v2 → ledger live mobile (qr scan / deeplink)
//
// requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — free signup at
// https://cloud.walletconnect.com (formerly cloud.reown.com).

"use client";

import { bytesToHex, toBytes } from "viem";
import type { LvMessage } from "./eip712";

const DEFAULT_PATH =
  process.env.NEXT_PUBLIC_LEDGER_DERIVATION_PATH || "44'/60'/0'/0/0";

const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export type SignResult = {
  signature: `0x${string}`; // r||s||v hex, 132 chars
};

export type Transport = "webhid" | "ledger-wallet";

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|opera mini|iemobile|mobile/i.test(
    navigator.userAgent
  );
}

export function pickTransport(): Transport {
  if (!isMobile() && isWebHidSupported()) return "webhid";
  return "ledger-wallet";
}

export async function signLvMessageInBrowser(
  msg: LvMessage,
  transport: Transport = pickTransport()
): Promise<SignResult> {
  if (transport === "webhid") return signViaWebHid(msg);
  return signViaWalletConnect(msg);
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

// ─── walletconnect v2 → ledger live ────────────────────────────────────────

let _wcProvider: any | null = null;

async function getWcProvider() {
  if (_wcProvider) return _wcProvider;
  if (!WC_PROJECT_ID) {
    throw new Error(
      "missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — sign up free at cloud.walletconnect.com and add it as an env var."
    );
  }
  const { EthereumProvider } = await import(
    "@walletconnect/ethereum-provider"
  );
  // ledger live wallet id in the walletconnect explorer (canonical)
  const LEDGER_LIVE_WALLET_ID =
    "19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927";

  _wcProvider = await EthereumProvider.init({
    projectId: WC_PROJECT_ID,
    chains: [1], // ethereum mainnet — used only for routing, no tx is sent
    showQrModal: true,
    methods: ["personal_sign", "eth_requestAccounts"],
    metadata: {
      name: "ledger secured",
      description: "hardware-anchored identity. one device tap, one badge.",
      url: APP_URL || "https://ledger-verified.vercel.app",
      icons: [`${APP_URL || "https://ledger-verified.vercel.app"}/api/badge/anonymous`],
    },
    qrModalOptions: {
      themeMode: "dark",
      themeVariables: {
        "--wcm-z-index": "9999",
        "--wcm-accent-color": "#ff7900",
        "--wcm-background-color": "#0a0c14",
        "--wcm-accent-fill-color": "#05060a",
      },
      // lock the modal to ledger live only — hide every other wallet
      enableExplorer: true,
      explorerRecommendedWalletIds: [LEDGER_LIVE_WALLET_ID],
      explorerExcludedWalletIds: "ALL",
    } as any,
  });
  return _wcProvider;
}

async function signViaWalletConnect(msg: LvMessage): Promise<SignResult> {
  try {
    const provider = await getWcProvider();

    // open the qr modal / deeplink to ledger live mobile
    if (!provider.session) {
      await provider.connect();
    }

    const accounts: string[] = await provider.request({
      method: "eth_requestAccounts",
    });
    const account = accounts?.[0];
    if (!account) throw new Error("no account returned from ledger wallet");

    const messageHex = bytesToHex(toBytes(msg.statement));
    const signature: string = await provider.request({
      method: "personal_sign",
      params: [messageHex, account],
    });

    return { signature: signature as `0x${string}` };
  } catch (e: any) {
    console.error("[walletconnect sign error]", e);
    throw new Error(
      e?.message || e?.shortMessage || "ledger wallet sign failed"
    );
  }
}
