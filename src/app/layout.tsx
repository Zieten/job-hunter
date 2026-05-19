import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { TopNav } from "@/components/TopNav";
import { BottomTabBar } from "@/components/BottomTabBar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Job Hunter",
  description: "Twice-daily scan of your favorite companies + broad job search, with AI fit scoring and tailored CVs.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e1a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <Providers>
          <TopNav />
          <main className="flex-1 pb-24 sm:pb-8">
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-safe">{children}</div>
          </main>
          <BottomTabBar />
        </Providers>
      </body>
    </html>
  );
}
