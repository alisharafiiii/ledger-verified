import type { Metadata } from "next";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "ledger secured",
  description: "hardware-anchored identity. one device tap, one badge.",
  openGraph: {
    title: "ledger secured",
    description: "hardware-anchored identity. one device tap, one badge.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ledger secured",
    description: "hardware-anchored identity. one device tap, one badge.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink bg-grid">{children}</body>
    </html>
  );
}
