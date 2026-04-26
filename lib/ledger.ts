// browser-only signer: dmk + webhid transport + ethereum signer kit.
// runs entirely in the user's browser — chrome / edge / brave / arc only
// (no safari, no firefox, no mobile — webhid is chromium-only).
//
// the user clicks "verify" → browser prompts for hid permission → ledger
// shows the plain message string (eip-191 / personal_sign) → user taps
// approve → we get a signature and post it to /api/verify on the server.
//
// note: we use personal_sign instead of eip-712 because custom typed-data
// schemas aren't on ledger's clear-sign whitelist and would require the
// user to manually enable blind-signing. personal_sign just shows the
// utf-8 message and works on any ethereum app out of the box.

"use client";

import {
  DeviceManagementKitBuilder,
  ConsoleLogger,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { webHidTransportFactory } from "@ledgerhq/device-transport-kit-web-hid";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import { firstValueFrom, lastValueFrom, filter, take, tap } from "rxjs";

import type { LvMessage } from "./eip712";

let _dmk: ReturnType<typeof buildDmk> | null = null;
function buildDmk() {
  return new DeviceManagementKitBuilder()
    .addTransport(webHidTransportFactory)
    .addLogger(new ConsoleLogger())
    .build();
}
function dmk() {
  if (!_dmk) _dmk = buildDmk();
  return _dmk;
}

const DEFAULT_PATH =
  process.env.NEXT_PUBLIC_LEDGER_DERIVATION_PATH || "44'/60'/0'/0/0";

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

async function openSession(): Promise<DeviceSessionId> {
  const sdk = dmk();
  // webhid requires a user gesture — startDiscovering triggers the
  // browser permission prompt for the user to pick their device.
  const discovered = await firstValueFrom(
    sdk.startDiscovering({}).pipe(take(1))
  );
  await sdk.stopDiscovering();
  // connect() resolves once the session is ready to receive commands —
  // no further state polling needed.
  const sessionId = await sdk.connect({ device: discovered });
  return sessionId;
}

async function closeSession(sessionId: DeviceSessionId) {
  try {
    await dmk().disconnect({ sessionId });
  } catch {
    /* noop */
  }
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
  const sessionId = await openSession();
  try {
    // no originToken — that field is for ledger's clear-sign metadata
    // service. setting it to a string not registered in their crypto asset
    // list (cal) makes the eth app throw "unknown favcoin error" when it
    // tries to look up matching context. omitting it keeps the signer
    // fully agnostic and lets personal_sign just show the raw message.
    const signer = new SignerEthBuilder({
      dmk: dmk(),
      sessionId,
    }).build();

    // eip-191 / personal_sign — device shows the utf-8 statement directly.
    // no clear-sign filter required, no blind-signing toggle needed.
    const signTask = signer.signMessage(DEFAULT_PATH, msg.statement);

    // wait for the action to settle (success OR failure) and inspect the
    // final state. lastValueFrom (vs firstValueFrom + filter) avoids the
    // "no elements in sequence" error when the device rejects or errors —
    // the observable completes without ever emitting a signature event.
    const finalState: any = await lastValueFrom(
      signTask.observable.pipe(
        tap((e) => console.debug("[ledger sign event]", e))
      )
    );

    const output = finalState?.output;
    const error = finalState?.error;
    const status = finalState?.status;

    if (!output?.r || !output?.s) {
      // surface the most useful info we have
      const detail =
        error?.message ||
        error?._tag ||
        (status ? `status=${status}` : null) ||
        "device returned no signature (was the request rejected on device?)";
      throw new Error(detail);
    }

    const { r, s, v } = output as { r: string; s: string; v: number };
    const sig = ("0x" +
      r.replace(/^0x/, "").padStart(64, "0") +
      s.replace(/^0x/, "").padStart(64, "0") +
      v.toString(16).padStart(2, "0")) as `0x${string}`;

    return { signature: sig };
  } finally {
    await closeSession(sessionId);
  }
}
