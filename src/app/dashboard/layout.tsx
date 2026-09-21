// The entire dashboard is per-user, per-request data (auth session, workspace
// membership, project content) — never statically prerenderable, and it must
// not be evaluated at build time in environments where Supabase isn't
// configured yet.
export const dynamic = "force-dynamic";

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
