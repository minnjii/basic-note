import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { DbProvider } from "@/components/providers/db-provider";
import { CryptoProvider } from "@/components/providers/crypto-provider";
import { AuthGate } from "@/components/providers/auth-gate";
import { LanguageProvider } from "@/components/providers/language-provider";
import { SwRegister } from "@/components/providers/sw-register";
import { UpdateGate } from "@/components/providers/update-gate";
import { OfflineReadyToast } from "@/components/providers/offline-ready-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "basic note",
  description: "basic note",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "basic note",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="referrer" content="no-referrer" />
        <meta name="theme-color" content="#f7f7f8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="h-full flex flex-col bg-background text-foreground overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SwRegister />
          <DbProvider>
            <LanguageProvider>
              <UpdateGate />
              <OfflineReadyToast />
              <CryptoProvider>
                <AuthGate>{children}</AuthGate>
              </CryptoProvider>
            </LanguageProvider>
          </DbProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
