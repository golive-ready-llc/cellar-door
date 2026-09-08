import { Skeleton } from "@/components/ui/skeleton";

interface WineListSkeletonProps {
  /** Number of skeleton rows to display (default: 6) */
  count?: number;
  /** Whether to show the grid variant for inventory view */
  variant?: "list" | "grid";
}

function SkeletonRow() {
  return (
    <div className="rounded-lg border bg-card p-4 flex gap-4 items-start">
      {/* Wine type circle */}
      <Skeleton className="shrink-0 w-10 h-10 rounded-full" />

      <div className="flex-1 min-w-0 space-y-2">
        {/* Name + price row */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 min-w-0 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-14 shrink-0" />
        </div>

        {/* Badge row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
      </div>
    </div>
  );
}

function SkeletonGridItem() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="shrink-0 w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  );
}

export function WineListSkeleton({
  count = 6,
  variant = "list",
}: WineListSkeletonProps) {
  if (variant === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }, (_, i) => (
          <SkeletonGridItem key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
