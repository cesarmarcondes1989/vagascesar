import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar · vagas",
  description: "Busca de vagas com IA, CV sob medida e acompanhamento de candidaturas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <Header />
        <main className="mx-auto max-w-[1280px] px-4 pt-9 pb-28 md:px-6">{children}</main>
      </body>
    </html>
  );
}
