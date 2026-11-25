import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "VENTURE — Dream. Connect. Build.", template: "%s · VENTURE" },
  description: "VENTURE transforme les ambitions individuelles en réalisations collectives. Publie ce que tu veux réaliser, réunis les bonnes personnes, construis-le.",
  applicationName: "VENTURE",
  appleWebApp: { capable: true, title: "VENTURE", statusBarStyle: "black-translucent" },
  openGraph: { title: "VENTURE — Dream. Connect. Build.", description: "Le réseau social pour construire la vie que tu veux vivre.", type: "website", locale: "fr_FR" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies the saved theme before paint (dark is the default).
const themeScript = `try{var t=localStorage.getItem('venture-theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
