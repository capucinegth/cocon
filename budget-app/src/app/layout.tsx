import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { appConfig } from "@/config/app";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${appConfig.name} — ${appConfig.tagline}`,
    template: `%s · ${appConfig.name}`,
  },
  description: "Suis ton budget mensuel, ton argent disponible et tes objectifs d'épargne, en douceur.",
};

export const viewport: Viewport = {
  themeColor: "#fff8fa",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${jakarta.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
