import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { Banners } from "@/components/Banners";

export const metadata: Metadata = {
  title: "ripStokx: rip packs, keep tokenized stock",
  description: "Rip a holo pack with USDC and keep the tokenized stock inside, from Dust to a 1,000× Grail. Provably fair via MagicBlock VRF. Devnet demo.",
};
export const viewport: Viewport = { themeColor: "#0D0B14" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* a CSS @import of this URL is dropped from the build, which left every page on system fonts */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Space+Mono:wght@400;700&display=swap" />
      </head>
      <body className="min-h-dvh">
        <Providers>
          <Nav />
          <Banners />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
          <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-dim sm:px-8">
            Devnet demo. Mock tokens only, no real money. Every pack holds tokenized stock; prices are relayed by our keeper (a trust assumption, see README).{" "}
            <a href="/prizes" className="underline">Odds</a> · <a href="/dashboard" className="underline">Stats</a> · <a href="/splashes" className="underline">Splashes</a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
