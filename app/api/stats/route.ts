import { NextResponse } from "next/server";
import { bumpVisits, readStats } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stats          → just read counters
// POST /api/stats         → increment visit counter, then read
//
// the page calls POST on mount once per session, GET when polling.
export async function GET() {
  try {
    return NextResponse.json(await readStats());
  } catch (e: any) {
    return NextResponse.json(
      { visits: 0, secured: 0, error: e?.message },
      { status: 200 }
    );
  }
}

export async function POST() {
  try {
    await bumpVisits().catch(() => {});
    return NextResponse.json(await readStats());
  } catch (e: any) {
    return NextResponse.json(
      { visits: 0, secured: 0, error: e?.message },
      { status: 200 }
    );
  }
}
