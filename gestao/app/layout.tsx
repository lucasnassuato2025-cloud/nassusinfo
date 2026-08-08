import type { Metadata, Viewport } from "next";
import PWARegister from "@/components/pwa-register";
import "./globals.css";
import "./modules.css";
import "./modules-fixes.css";
import "./pre-cakto.css";
import "./nassus-one.css";
import "./nassus-one-legacy.css";
import "./nassus-one-polish.css";

export const metadata: Metadata = {
  title: { default: "Nassus Gestão", template: "%s | Nassus Gestão" },
  description: "Gestão simples, segura e profissional para empresas de serviços.",
  applicationName: "Nassus Gestão",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Nassus Gestão", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07111d",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><PWARegister />{children}</body>
    </html>
  );
}
