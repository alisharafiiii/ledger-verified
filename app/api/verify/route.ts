import { NextResponse } from "next/server";
import { recoverMessageAddress, isAddress, getAddress } from "viem";
import type { LvMessage } from "@/lib/eip712";
import { consumeNonce, saveVerified, getVerified } from "@/lib/redis";
import { normalizeHandle } from "@/lib/handle";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    message?: LvMessage;
    signature?: `0x${string}`;
  };
  const { message, signature } = body;

  if (!message || !signature) {
    return NextResponse.json({ error: "missing message or signature" }, { status: 400 });
  }
  const handle = normalizeHandle(message.handle);
  if (!handle || handle !== message.handle) {
    return NextResponse.json({ error: "invalid handle in message" }, { status: 400 });
  }

  // confirm the nonce came from us, then burn it
  let issuedFor: string | null = null;
  try {
    issuedFor = await consumeNonce(message.nonce);
  } catch (e: any) {
    return NextResponse.json(
      { error: "redis not configured", detail: e?.message },
      { status: 500 }
    );
  }
  if (!issuedFor || issuedFor !== handle) {
    return NextResponse.json(
      { error: "unknown or expired nonce" },
      { status: 400 }
    );
  }

  // recover signer from the personal_sign / eip-191 message
  let address: `0x${string}`;
  try {
    address = await recoverMessageAddress({
      message: message.statement,
      signature,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "signature recovery failed", detail: e?.message },
      { status: 400 }
    );
  }
  if (!isAddress(address)) {
    return NextResponse.json({ error: "bad recovered address" }, { status: 400 });
  }

  // optional: prevent re-binding a handle to a different address
  const existing = await getVerified(handle);
  if (existing && existing.address.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json(
      { error: "handle already verified by a different device" },
      { status: 409 }
    );
  }

  const record = {
    handle,
    address: getAddress(address),
    timestamp: Date.now(),
    nonce: message.nonce,
  };
  await saveVerified(record);

  // never return the recovered address publicly — only confirm success.
  return NextResponse.json({
    ok: true,
    handle,
    badgeUrl: `/verify/${handle}`,
  });
}
