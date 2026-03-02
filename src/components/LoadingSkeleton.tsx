import { cn } from "@/lib/utils";

function SkeletonBlock({
  className,
  style,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} style={style} />;
}

/* ─── Dashboard Skeleton: 4 stat cards + 2 content areas ─── */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Stat cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-8 w-8 rounded-full" />
            </div>
            <SkeletonBlock className="h-8 w-32" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Content areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-card p-6 space-y-4">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-48 w-full" />
            <div className="flex gap-3">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Table Skeleton: header + rows ─── */
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Table header */}
      <div className="border-b border-border/40 px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBlock
            key={i}
            className={cn("h-3", i === 0 ? "w-32" : "w-20")}
          />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="border-b border-border/20 px-4 py-3.5 flex items-center gap-4"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonBlock
              key={colIdx}
              className={cn(
                "h-4",
                colIdx === 0 ? "w-28" : colIdx === 1 ? "w-16" : "w-20"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Card Skeleton: single card ─── */
export function CardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
      </div>
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-3/4" />
      <div className="flex gap-2 pt-2">
        <SkeletonBlock className="h-8 w-20 rounded-md" />
        <SkeletonBlock className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

/* ─── Chart Skeleton: chart area ─── */
export function ChartSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      {/* Chart header */}
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-5 w-36" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-7 w-14 rounded-md" />
          <SkeletonBlock className="h-7 w-14 rounded-md" />
          <SkeletonBlock className="h-7 w-14 rounded-md" />
        </div>
      </div>

      {/* Chart area with simulated bars */}
      <div className="flex items-end gap-2 h-48 pt-4">
        {[45, 60, 35, 70, 55, 80, 50, 65, 40, 75, 58, 68].map(
          (height, i) => (
            <SkeletonBlock
              key={i}
              className="flex-1 rounded-t-md"
              style={{ height: `${height}%` }}
            />
          )
        )}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between px-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}
