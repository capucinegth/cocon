import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";

/** Application installable (écran d'accueil du téléphone, fenêtre dédiée sur ordinateur). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${appConfig.name} — ${appConfig.tagline}`,
    short_name: appConfig.name,
    description: "Suis ton budget mensuel, ton argent disponible et tes objectifs d'épargne, en douceur.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8fa",
    theme_color: "#fff8fa",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
