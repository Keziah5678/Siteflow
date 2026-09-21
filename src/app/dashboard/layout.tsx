import { isSupabaseConfigured } from "@/lib/supabase/server";
import { NotConfiguredNotice } from "@/components/auth/not-configured-notice";

// The entire dashboard is per-user, per-request data (auth session, workspace
// membership, project content) — never statically prerenderable, and it must
// not be evaluated at build time in environments where Supabase isn't
// configured yet.
export const dynamic = "force-dynamic";

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md">
          <NotConfiguredNotice />
        </div>
      </div>
    );
  }
  return children;
}
