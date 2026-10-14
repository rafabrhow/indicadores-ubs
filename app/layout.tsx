import type { Metadata, Viewport } from "next";

import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardCacheProvider } from "@/context/DashboardCacheContext";
import FonteSistemaGlobal from "@/components/config/FonteSistemaGlobal";
import ServiceWorkerBrasil360 from "@/components/pwa/ServiceWorkerBrasil360";

export const metadata: Metadata = {
  title: "Brasil 360",
  description:
    "Gestão e acompanhamento dos indicadores da Atenção Primária à Saúde",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/icons/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        url: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Brasil 360",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#003B8E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <DashboardCacheProvider>
          <ServiceWorkerBrasil360 />
          <FonteSistemaGlobal />
          {children}
          </DashboardCacheProvider>
        </AuthProvider>
      </body>
    </html>
  );
}