import { NextResponse } from "next/server";
import { recoverMessageAddress, isAddress, getAddress } from "viem";
import type { LvMessage } from "@/lib/eip712";
import { consumeNonce, saveVerified, getVerified } from "@/lib/redis";
import { normalizeHandle, isPlatform } from "@/lib/handle";

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
  if (!isPlatform(message.platform)) {
    return NextResponse.json({ error: "invalid platform in message" }, { status: 400 });
  }
  const handle = normalizeHandle(message.handle, message.platform);
  if (!handle || handle !== message.handle) {
    return NextResponse.json({ error: "invalid handle in message" }, { status: 400 });
  }

  // confirm the nonce came from us, then burn it
  let issued: { platform: typeof message.platform; handle: string } | null = null;
  try {
    issued = await consumeNonce(message.nonce);
  } catch (e: any) {
    return NextResponse.json(
      { error: "redis not configured", detail: e?.message },
      { status: 500 }
    );
  }
  if (!issued || issued.platform !== message.platform || issued.handle !== handle) {
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

  // prevent re-binding a (platform, handle) to a different address
  const existing = await getVerified(message.platform, handle);
  if (existing && existing.address.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json(
      { error: "handle already secured by a different device" },
      { status: 409 }
    );
  }

  const record = {
    platform: message.platform,
    handle,
    address: getAddress(address),
    timestamp: Date.now(),
    nonce: message.nonce,
  };
  await saveVerified(record);

  // never return the recovered address publicly — only confirm success.
  return NextResponse.json({
    ok: true,
    platform: message.platform,
    handle,
    badgeUrl: `/verify/${message.platform}/${handle}`,
  });
}
