import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";

import "./globals.css";
import "./brand.css";
import "./premium.css";
import "./boot.css";
import "./auth-pro.css";
import "./auth-private.css";
import "./crm-operations.css";
import "./crm-suite.css";
import "./crm-suite-state.css";
import "./business-suite.css";
import "./infrastructure.css";
import "./black-edition.css";

const inter = Inter({
  variable: "--font-nassus-body",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-nassus-display",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-nassus-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nassus CRM Black Edition | Central de Negócios",
  description: "Gestão comercial, operação, infraestrutura e inteligência da Nassusinfo.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/api/favicon?v=9", type: "image/x-icon", sizes: "any" },
      { url: "/api/brand-logo?v=9", type: "image/png", sizes: "256x256" },
    ],
    shortcut: "/api/favicon?v=9",
    apple: "/api/brand-logo?v=9",
  },
};

export const viewport: Viewport = {
  themeColor: "#060912",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="nassus-black-edition">
      <body className={`${inter.variable} ${manrope.variable} ${jetBrainsMono.variable}`}>{children}</body>
    </html>
  );
}
