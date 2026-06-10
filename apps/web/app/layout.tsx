import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../src/providers";

export const metadata: Metadata = {
  title: "Aeonomy",
  description: "Spawn on-chain agents with deterministic smart wallets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
