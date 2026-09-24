import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verita — staked price accountability on X Layer 196",
  description: "Live attested marks, market status no feed reports, and on-chain slashing you can re-resolve yourself.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
