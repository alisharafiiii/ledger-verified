import { Redis } from "@upstash/redis";

// lazy singleton — env may not be set during `next build`
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — see .env.example"
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export type VerifiedRecord = {
  handle: string;        // lowercased, no leading @
  address: string;       // 0x… recovered signer
  timestamp: number;     // ms epoch when verified
  nonce: string;         // the nonce used in the signed message
};

const handleKey = (h: string) => `lv:handle:${h.toLowerCase()}`;
const nonceKey = (n: string) => `lv:nonce:${n}`;

// store a one-time nonce for ~5 minutes so /api/verify can confirm it was issued
export async function rememberNonce(nonce: string, handle: string) {
  await getRedis().set(nonceKey(nonce), handle.toLowerCase(), { ex: 300 });
}

export async function consumeNonce(nonce: string): Promise<string | null> {
  const r = getRedis();
  const handle = (await r.get<string>(nonceKey(nonce))) ?? null;
  if (handle) await r.del(nonceKey(nonce));
  return handle;
}

export async function saveVerified(rec: VerifiedRecord) {
  await getRedis().set(handleKey(rec.handle), rec);
}

export async function getVerified(handle: string): Promise<VerifiedRecord | null> {
  return (await getRedis().get<VerifiedRecord>(handleKey(handle))) ?? null;
}
