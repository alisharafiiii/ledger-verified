import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVerified } from "@/lib/redis";
import { normalizeHandle, isPlatform } from "@/lib/handle";
import BadgeDownloads from "@/components/BadgeDownloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { platform: string; handle: string };
}): Promise<Metadata> {
  if (!isPlatform(params.platform)) return { title: "ledger secured" };
  const handle = normalizeHandle(params.handle, params.platform);
  if (!handle) return { title: "ledger secured" };
  const rec = await getVerified(params.platform, handle).catch(() => null);
  if (!rec) {
    return {
      title: `@${handle} — not yet ledger secured`,
      description: "hardware-anchored identity. one device tap, one badge.",
    };
  }
  const date = new Date(rec.timestamp).toISOString().slice(0, 10);
  const title = `@${handle} is ledger secured 🔐`;
  const description = `hardware-anchored ${params.platform} identity, secured on ${date}. no api, no oauth, just a device tap.`;
  const ogImage = `/api/og/${params.platform}/${handle}`;
  return {
    title,
    description,
    openGraph: {
      title, description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title, description,
      images: [ogImage],
    },
  };
}

export default async function VerifyPage({
  params,
}: {
  params: { platform: string; handle: string };
}) {
  if (!isPlatform(params.platform)) notFound();
  const handle = normalizeHandle(params.handle, params.platform);
  if (!handle) notFound();
  const rec = await getVerified(params.platform, handle).catch(() => null);

  const isLinkedin = params.platform === "linkedin";
  const accent = isLinkedin ? "#0a66c2" : "#ff7900";

  if (!rec) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <div className="text-xs tracking-[0.3em]" style={{ color: accent }}>
          {params.platform} · ledger · secured
        </div>
        <h1 className="mt-3 text-3xl">@{handle} is not secured yet.</h1>
        <a
          href="/"
          className="mt-8 rounded-xl border px-5 py-3"
          style={{ borderColor: accent, color: accent }}
        >
          secure your handle →
        </a>
      </main>
    );
  }

  const date = new Date(rec.timestamp).toISOString().slice(0, 10);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-xs tracking-[0.3em]" style={{ color: accent }}>
        {params.platform} · ledger · secured
      </div>

      <h1 className="mt-8 text-4xl">@{handle}</h1>
      <p className="mt-2 text-sm text-white/60">hardware-anchored identity · {date}</p>

      <div className="mt-10 w-full">
        <img
          src={`/api/badge/${params.platform}/${handle}`}
          alt={`@${handle} ledger secured badge`}
          className="w-full rounded-2xl border border-line"
        />
      </div>

      <div className="mt-4 w-full">
        <BadgeDownloads platform={params.platform} handle={handle} />
      </div>

      <div className="mt-10 grid w-full gap-3 text-xs text-white/50">
        <div className="rounded-lg border border-line bg-panel/40 p-3">
          this page confirms @{handle} on {params.platform} signed a unique challenge using a ledger device.
        </div>
        <div className="rounded-lg border border-line bg-panel/40 p-3">
          the device address is never published. only the handle and date are public.
        </div>
      </div>

      <a
        href="/"
        className="mt-10 text-xs underline-offset-4 hover:underline"
        style={{ color: accent }}
      >
        secure your own handle →
      </a>
    </main>
  );
}
