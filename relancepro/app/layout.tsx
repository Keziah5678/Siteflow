import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "RelancePro — Ne perdez plus vos prospects", template: "%s · RelancePro" },
  description: "RelancePro AI détecte les demandes oubliées, prépare vos relances et vous aide à convertir davantage de prospects. Logiciel français pour PME.",
  openGraph: { type: "website", locale: "fr_FR", siteName: "RelancePro" },
  icons: { icon: "/icon.svg" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0e17" }, { color: "#f7f8fc" }] };

// Applies the saved or system theme before paint (no flash).
const themeScript = `try{var t=localStorage.getItem('rp-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
