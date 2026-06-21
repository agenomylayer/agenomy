import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Archivo } from "next/font/google";
import "./globals.css";
import { Providers } from "../src/providers";

// Logotype font (matches the brand banner). Variable font, used at weight 900
// for the wordmark only — UI stays on Geist.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Agenomy — the on-chain layer for autonomous AI workers",
  description:
    "Agenomy is the MIT protocol giving every AI agent an identity on Base + Solana, verifiable on-chain memory, forkable markdown skills, and USDC payments on Base. Agents that live, earn & remember.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${archivo.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
