import type { Metadata } from "next";
import { Staatliches, Inter } from "next/font/google";
import "./globals.css";

const staatliches = Staatliches({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-logo",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "500"],
  variable: "--font-logo-plan",
});

export const metadata: Metadata = {
  title: "DopaPlan - パーキンソン病　診療補助ツール",
  description:
    "パーキンソン病患者さんの処方や状態から現在のLEDD換算を計算し、症状に基づく次の一手提案を行う診療補助ツールです。",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${staatliches.variable} ${inter.variable} antialiased min-h-screen`}>{children}</body>
    </html>
  );
}
