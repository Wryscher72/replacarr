import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/Sidebar";

// Self-hosted via next/font — no external CDN request, better Core Web Vitals
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Replacarr — Media Console",
  description: "Unified modern frontend for Sonarr and Radarr",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[var(--color-bg-base)] min-h-screen antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            {/* Main content area — offset by sidebar on large screens only */}
            <main className="flex-1 lg:ml-60 flex flex-col min-h-screen">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
