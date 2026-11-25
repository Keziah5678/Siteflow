import { cn } from "@/lib/utils";

export function PageWithRail({ children, rail, className }: { children: React.ReactNode; rail?: React.ReactNode; className?: string }) {
  return (
    <div className="flex gap-8 px-4 py-5 sm:px-6 lg:py-8">
      <main id="main" className={cn("mx-auto w-full min-w-0 max-w-[640px] flex-1", className)}>
        {children}
      </main>
      {rail && <aside className="sticky top-8 hidden h-fit w-[300px] shrink-0 space-y-6 xl:block">{rail}</aside>}
    </div>
  );
}

export function Page({ children, className, wide = false }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <main id="main" className={cn("mx-auto w-full px-4 py-5 sm:px-6 lg:py-8", wide ? "max-w-[1040px]" : "max-w-[720px]", className)}>
      {children}
    </main>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
