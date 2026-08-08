import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nassus Gestão",
  description: "Gestão simples e profissional para empresas de serviços.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
