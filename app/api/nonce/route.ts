import { NextResponse } from "next/server";
import { buildMessage } from "@/lib/eip712";
import { rememberNonce } from "@/lib/redis";
import { normalizeHandle } from "@/lib/handle";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { handle } = (await req.json()) as { handle?: string };
  const norm = normalizeHandle(handle ?? "");
  if (!norm) {
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  }
  const msg = buildMessage(norm);
  try {
    await rememberNonce(msg.nonce, norm);
  } catch (e: any) {
    // redis not configured — for local dev still return the message,
    // /api/verify will reject without redis
    console.warn("rememberNonce failed:", e?.message);
  }
  return NextResponse.json({ message: msg });
}
