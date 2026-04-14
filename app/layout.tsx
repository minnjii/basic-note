import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DbProvider } from "@/components/providers/db-provider";
import { CryptoProvider } from "@/components/providers/crypto-provider";
import { AuthGate } from "@/components/providers/auth-gate";
import { SwRegister } from "@/components/providers/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "just note",
  description: "개인용 보안 노트",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "just note",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="referrer" content="no-referrer" />
        <meta name="theme-color" content="#09090b" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SwRegister />
        <DbProvider>
          <CryptoProvider>
            <AuthGate>{children}</AuthGate>
          </CryptoProvider>
        </DbProvider>
      </body>
    </html>
  );
}
