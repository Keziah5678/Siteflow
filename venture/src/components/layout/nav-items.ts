import { Compass, Home, MessageCircle, PlusCircle, User } from "lucide-react";

export const NAV = [
  { href: "/", label: "Accueil", icon: Home, key: "home" },
  { href: "/explore", label: "Explorer", icon: Compass, key: "explore" },
  { href: "/create", label: "Créer", icon: PlusCircle, key: "create" },
  { href: "/messages", label: "Messages", icon: MessageCircle, key: "messages" },
  { href: "/profile", label: "Profil", icon: User, key: "profile" },
] as const;

export function activeKey(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/explore")) return "explore";
  if (pathname.startsWith("/create")) return "create";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/profile") || pathname.startsWith("/u/") || pathname.startsWith("/settings")) return "profile";
  return "";
}
