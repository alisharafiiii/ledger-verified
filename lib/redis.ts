import { Redis } from "@upstash/redis";
import type { Platform } from "./handle";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error(
      "missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — see .env.example"
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export type VerifiedRecord = {
  platform: Platform;
  handle: string;        // lowercased, no leading @
  address: string;       // 0x… recovered signer
  timestamp: number;     // ms epoch when verified
  nonce: string;         // the nonce used in the signed message
};

const handleKey = (p: Platform, h: string) =>
  `lv:handle:${p}:${h.toLowerCase()}`;
const nonceKey = (n: string) => `lv:nonce:${n}`;
const STATS_VISITS = "lv:stats:visits";
const STATS_SECURED = "lv:stats:secured";

// store a one-time nonce for ~5 minutes; value carries handle + platform
export async function rememberNonce(nonce: string, platform: Platform, handle: string) {
  await getRedis().set(
    nonceKey(nonce),
    `${platform}:${handle.toLowerCase()}`,
    { ex: 300 }
  );
}

export async function consumeNonce(
  nonce: string
): Promise<{ platform: Platform; handle: string } | null> {
  const r = getRedis();
  const raw = (await r.get<string>(nonceKey(nonce))) ?? null;
  if (!raw) return null;
  await r.del(nonceKey(nonce));
  const [platform, handle] = raw.split(":");
  if ((platform !== "x" && platform !== "linkedin") || !handle) return null;
  return { platform: platform as Platform, handle };
}

export async function saveVerified(rec: VerifiedRecord) {
  const r = getRedis();
  const key = handleKey(rec.platform, rec.handle);
  // only count first-time secures, not re-verifies
  const existing = await r.get(key);
  await r.set(key, rec);
  if (!existing) {
    await r.incr(STATS_SECURED);
  }
}

export async function getVerified(
  platform: Platform,
  handle: string
): Promise<VerifiedRecord | null> {
  return (
    (await getRedis().get<VerifiedRecord>(handleKey(platform, handle))) ?? null
  );
}

// stats counters
export async function bumpVisits(): Promise<number> {
  return await getRedis().incr(STATS_VISITS);
}

export async function readStats(): Promise<{ visits: number; secured: number }> {
  const r = getRedis();
  const [visits, secured] = await Promise.all([
    r.get<number>(STATS_VISITS),
    r.get<number>(STATS_SECURED),
  ]);
  return { visits: visits ?? 0, secured: secured ?? 0 };
}
