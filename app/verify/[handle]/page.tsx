import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVerified } from "@/lib/redis";
import { normalizeHandle } from "@/lib/handle";
import BadgeDownloads from "@/components/BadgeDownloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// og:image meta tags so the verify link auto-renders as a card on x / discord /
// telegram / slack / etc. without these every share would just look like text.
export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const handle = normalizeHandle(params.handle);
  if (!handle) return { title: "ledger secured" };
  const rec = await getVerified(handle).catch(() => null);
  if (!rec) {
    return {
      title: `@${handle} — not yet ledger secured`,
      description: "hardware-anchored identity. one device tap, one badge.",
    };
  }
  const date = new Date(rec.timestamp).toISOString().slice(0, 10);
  const title = `@${handle} is ledger secured 🔐`;
  const description = `hardware-anchored identity, secured on ${date}. no x api, no oauth, just a device tap.`;
  const ogImage = `/api/og/${handle}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function VerifyPage({
  params,
}: {
  params: { handle: string };
}) {
  const handle = normalizeHandle(params.handle);
  if (!handle) notFound();
  const rec = await getVerified(handle).catch(() => null);
  if (!rec) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <div className="text-xs tracking-[0.3em] text-white/40">ledger · secured</div>
        <h1 className="mt-3 text-3xl">@{handle} is not secured yet.</h1>
        <a href="/" className="mt-8 rounded-xl border border-neon/50 px-5 py-3 text-neon">
          secure your handle →
        </a>
      </main>
    );
  }
  const date = new Date(rec.timestamp).toISOString().slice(0, 10);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-xs tracking-[0.3em] text-neon">ledger · secured</div>

      {/* big lock chip */}
      <div className="mt-8 flex h-28 w-28 items-center justify-center rounded-full border border-neon/60 shadow-neon">
        <svg viewBox="0 0 100 100" className="h-12 w-12" aria-hidden>
          <path
            d="M30 55 v-12 c0 -15 40 -15 40 0 v12"
            fill="none"
            stroke="#ff7900"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="22" y="55" width="56" height="36" rx="6" fill="#ff7900" />
          <circle cx="50" cy="71" r="5" fill="#05060a" />
          <rect x="48" y="73" width="4" height="10" fill="#05060a" />
        </svg>
      </div>

      <h1 className="mt-8 text-4xl">@{handle}</h1>
      <p className="mt-2 text-sm text-white/60">hardware-anchored identity · {date}</p>

      {/* the actual badge */}
      <div className="mt-10 w-full">
        <img
          src={`/api/badge/${handle}`}
          alt={`@${handle} ledger secured badge`}
          className="w-full rounded-2xl border border-line"
        />
      </div>

      <div className="mt-4 w-full">
        <BadgeDownloads handle={handle} />
      </div>

      <div className="mt-10 grid w-full gap-3 text-xs text-white/50">
        <div className="rounded-lg border border-line bg-panel/40 p-3">
          this page confirms @{handle} signed a unique challenge using a ledger device.
        </div>
        <div className="rounded-lg border border-line bg-panel/40 p-3">
          the device address is never published. only the handle and date are public.
        </div>
      </div>

      <a
        href="/"
        className="mt-10 text-xs text-neon underline-offset-4 hover:underline"
      >
        secure your own handle →
      </a>
    </main>
  );
}
