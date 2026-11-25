import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { Banners } from "@/components/Banners";

export const metadata: Metadata = {
  title: "Stock Scratchers: rip packs, keep tokenized stock",
  description: "Rip a holo pack with USDC and keep the tokenized stock inside, from Dust to a 1,000× Grail. Provably fair via MagicBlock VRF. Devnet demo.",
};
export const viewport: Viewport = { themeColor: "#0D0B14" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Providers>
          <Nav />
          <Banners />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-dim">
            Devnet demo. Mock tokens only, no real money. Every pack holds tokenized stock; prices are relayed by our keeper (a trust assumption, see README).
          </footer>
        </Providers>
      </body>
    </html>
  );
}
