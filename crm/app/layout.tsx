import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import "./brand.css";
import "./premium.css";
import "./boot.css";
import "./auth-pro.css";
import "./crm-operations.css";
import "./crm-suite.css";
import "./crm-suite-state.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nassus CRM Pro | Gestão Comercial",
  description: "Central comercial, projetos, financeiro e auditoria inteligente da Nassusinfo.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/api/favicon?v=8", type: "image/x-icon", sizes: "any" },
      { url: "/api/brand-logo?v=8", type: "image/png", sizes: "256x256" },
    ],
    shortcut: "/api/favicon?v=8",
    apple: "/api/brand-logo?v=8",
  },
};

export const viewport: Viewport = {
  themeColor: "#07101f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geist.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
