import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton placeholder that matches the PatientCard layout.
 * Shown while patient data is loading to reduce perceived latency.
 */
export function PatientCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border/30 shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 px-5 py-4 bg-white/[0.03] border-b border-border/20">
        <div className="flex items-center gap-3 flex-1">
          {/* Avatar */}
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
          <div className="flex gap-2.5 items-center">
            {/* Name input */}
            <Skeleton className="h-8 w-[180px] rounded-xl" />
            {/* Bed input */}
            <Skeleton className="h-8 w-[90px] rounded-xl" />
            {/* Badges */}
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Clinical Summary section */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        {/* Interval Events section */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        {/* Two-column grid (imaging & labs) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders multiple skeleton cards for a loading patient list.
 */
export function PatientListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <PatientCardSkeleton key={i} />
      ))}
    </div>
  );
}
