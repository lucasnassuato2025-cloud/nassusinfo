import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./modules.css";

export const metadata: Metadata = {
  title: { default: "Nassus Gestão", template: "%s | Nassus Gestão" },
  description: "Gestão simples e profissional para empresas de serviços.",
  applicationName: "Nassus Gestão",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nassus Gestão", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2271b1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
