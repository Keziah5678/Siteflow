import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/session";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "ARTHENIS — Where worlds are born",
  description: "Créez des mondes vivants, cohérents et persistants. Carte 3D, mémoire IA, moteur de cohérence et temps simulé.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#05030a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ToastProvider>
          <SessionProvider>{children}</SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
