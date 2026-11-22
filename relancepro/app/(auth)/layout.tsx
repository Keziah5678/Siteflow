import Link from "next/link";
import { Logo } from "@/components/ui";
import { ThemeToggle } from "@/components/client";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,#2f6bff26,transparent_65%)]" />
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5"><Link href="/" aria-label="Accueil"><Logo /></Link><ThemeToggle /></header>
      <main className="relative mx-auto w-full max-w-md flex-1 px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
