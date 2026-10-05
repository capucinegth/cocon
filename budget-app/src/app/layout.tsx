import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
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
  applicationName: appConfig.name,
  appleWebApp: { capable: true, title: appConfig.name, statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  // Données personnelles : pas d'indexation par les moteurs de recherche.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fff8fa",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

const discreetScript = `try{if(localStorage.getItem("cocon:discreet")==="1")document.documentElement.setAttribute("data-discreet","")}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${jakarta.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Mode discret appliqué avant le premier affichage : aucun montant visible, même une fraction de seconde. */}
        <script dangerouslySetInnerHTML={{ __html: discreetScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
