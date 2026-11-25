import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-8" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-28" />
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  );
}
