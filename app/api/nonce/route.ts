import { NextResponse } from "next/server";
import { buildMessage } from "@/lib/eip712";
import { rememberNonce } from "@/lib/redis";
import { normalizeHandle, isPlatform } from "@/lib/handle";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { handle, platform } = (await req.json()) as {
    handle?: string;
    platform?: string;
  };
  if (!isPlatform(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  const norm = normalizeHandle(handle ?? "", platform);
  if (!norm) {
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  }
  const msg = buildMessage(platform, norm);
  try {
    await rememberNonce(msg.nonce, platform, norm);
  } catch (e: any) {
    console.warn("rememberNonce failed:", e?.message);
  }
  return NextResponse.json({ message: msg });
}
