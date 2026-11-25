"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, LogIn, Search, Shield, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, activeKey } from "./nav-items";
import { CountBadge } from "./live-counts";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";

type Viewer = { display_name: string; username: string; avatar_url: string | null; is_staff: boolean; is_business: boolean } | null;

export function Sidebar({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const active = activeKey(pathname);
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-border px-3 py-5 lg:flex">
      <Link href="/" className="mb-8 px-3" aria-label="VENTURE — accueil">
        <Logo />
      </Link>
      <nav className="flex flex-col gap-1" aria-label="Navigation principale">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isCreate = item.key === "create";
          const href = item.key === "profile" && viewer ? `/u/${viewer.username}` : item.href;
          return (
            <Link
              key={item.key}
              href={href}
              aria-current={active === item.key ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors",
                isCreate ? "my-1 bg-primary font-medium text-white hover:bg-primary-hover" : active === item.key ? "bg-card font-medium text-fg" : "text-muted hover:bg-card hover:text-fg",
              )}
            >
              <span className="relative">
                <Icon className="size-5" strokeWidth={active === item.key || isCreate ? 2.2 : 1.8} />
                {item.key === "messages" && <CountBadge kind="messages" />}
              </span>
              {item.label}
            </Link>
          );
        })}
        <Link href="/notifications" aria-current={pathname.startsWith("/notifications") ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-muted hover:bg-card hover:text-fg", pathname.startsWith("/notifications") && "bg-card text-fg")}>
          <span className="relative">
            <Bell className="size-5" strokeWidth={1.8} />
            <CountBadge kind="notifications" />
          </span>
          Notifications
        </Link>
        <Link href="/ai" className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-muted hover:bg-card hover:text-fg", pathname.startsWith("/ai") && "bg-card text-fg")}>
          <Sparkles className="size-5" strokeWidth={1.8} /> VENTURE AI
        </Link>
        {viewer?.is_business && (
          <Link href="/business" className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-muted hover:bg-card hover:text-fg", pathname.startsWith("/business") && "bg-card text-fg")}>
            <Building2 className="size-5" strokeWidth={1.8} /> Espace pro
          </Link>
        )}
        {viewer?.is_staff && (
          <Link href="/admin" className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-muted hover:bg-card hover:text-fg", pathname.startsWith("/admin") && "bg-card text-fg")}>
            <Shield className="size-5" strokeWidth={1.8} /> Administration
          </Link>
        )}
      </nav>
      <div className="mt-auto space-y-1">
        <ThemeToggle withLabel className="w-full px-3 py-2.5" />
        {viewer ? (
          <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-card">
            <Avatar name={viewer.display_name} src={viewer.avatar_url} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{viewer.display_name}</span>
              <span className="block truncate text-[12px] text-subtle">@{viewer.username}</span>
            </span>
            <Settings className="size-4 text-subtle" />
          </Link>
        ) : (
          <Link href="/login" className={buttonClass("secondary", "md", "w-full")}>
            <LogIn /> Se connecter
          </Link>
        )}
      </div>
    </aside>
  );
}

export function MobileTopBar({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--bg)_85%,transparent)] px-4 py-3 backdrop-blur-lg lg:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
      <Link href="/" aria-label="VENTURE — accueil">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/explore?focus=search" className="rounded-xl p-2 text-muted hover:text-fg" aria-label="Rechercher">
          <Search className="size-5" />
        </Link>
        {signedIn ? (
          <Link href="/notifications" className="relative rounded-xl p-2 text-muted hover:text-fg" aria-label="Notifications">
            <Bell className="size-5" />
            <CountBadge kind="notifications" className="absolute right-0.5 top-0.5 min-w-[16px] rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-white" />
          </Link>
        ) : (
          <Link href="/login" className={buttonClass("secondary", "sm")}>
            Connexion
          </Link>
        )}
      </div>
    </header>
  );
}

export function MobileTabBar({ username }: { username: string | null }) {
  const pathname = usePathname();
  const active = activeKey(pathname);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] backdrop-blur-lg lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Navigation principale">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {NAV.map((item) => {
          const Icon = item.icon;
          const href = item.key === "profile" && username ? `/u/${username}` : item.href;
          if (item.key === "create") {
            return (
              <li key={item.key} className="flex justify-center">
                <Link href={href} aria-label="Créer un projet" className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_8px_24px_-6px_rgb(124_58_237/0.8)] transition-transform active:scale-95">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.key}>
              <Link href={href} aria-current={active === item.key ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-1 text-[11px]", active === item.key ? "text-fg" : "text-subtle")}>
                <span className="relative">
                  <Icon className="size-[22px]" strokeWidth={active === item.key ? 2.2 : 1.8} />
                  {item.key === "messages" && <CountBadge kind="messages" />}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
