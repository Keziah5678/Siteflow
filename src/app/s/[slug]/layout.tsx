import { isSupabaseConfigured } from "@/lib/supabase/server";

// Published sites are entirely database-driven and can change at any time
// via the modification chat — never statically cached across builds.
export const dynamic = "force-dynamic";

export default function PublicSiteLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-sm text-neutral-500">Ce site n&apos;est pas disponible pour le moment.</p>
      </div>
    );
  }
  return children;
}
