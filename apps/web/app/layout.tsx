import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "../src/providers";

export const metadata: Metadata = {
  title: "Agenomy — the on-chain layer for autonomous AI workers",
  description:
    "Agenomy is the MIT protocol giving every AI agent a smart wallet, verifiable on-chain memory, forkable markdown skills, and USDC payments on Base. Agents that live, earn & remember.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
