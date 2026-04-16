import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Greeting */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-16 mt-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border p-6">
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-4"
          style={{ borderLeftWidth: 4, borderLeftColor: "hsl(var(--muted))" }}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 flex-1" />
          </div>
          <div className="mt-3 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <div className="mt-3 flex gap-1">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TasksBoardSkeleton() {
  return (
    <div className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 overflow-x-auto snap-x snap-mandatory pb-4 md:overflow-x-visible md:pb-0 animate-in fade-in duration-300">
      {[1, 2, 3, 4].map((col) => (
        <div
          key={col}
          className="flex flex-col rounded-xl border border-border bg-secondary/50 p-3 min-h-[200px] min-w-[260px] snap-center shrink-0 md:min-w-0 md:shrink"
        >
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-6" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: col === 1 ? 3 : col === 2 ? 2 : 1 }).map(
              (_, j) => (
                <div
                  key={j}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in duration-300">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <Skeleton className="h-2 w-full" />
          <div className="p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 flex-1" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-1.5 flex-1 rounded-full" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col gap-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
        {/* Title */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-14 rounded-md" />
          <Skeleton className="h-8 flex-1" />
        </div>
        {/* Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Skeleton className="h-3 w-12 mb-2" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
        {/* Editor */}
        <div>
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      </div>
      {/* Side panel */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="rounded-lg border border-border p-4">
          <Skeleton className="h-5 w-24 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GraphSkeleton() {
  return (
    <div className="w-full h-[calc(100vh-5rem)] rounded-lg border border-border flex items-center justify-center animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {/* Animated circles simulating graph nodes */}
          <Skeleton className="h-6 w-6 rounded-full absolute -top-8 -left-4" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-5 rounded-full absolute -top-2 left-10" />
          <Skeleton className="h-6 w-6 rounded-full absolute top-6 -left-8" />
          <Skeleton className="h-4 w-4 rounded-full absolute top-8 left-6" />
        </div>
        <Skeleton className="h-4 w-40 mt-4" />
      </div>
    </div>
  );
}

export function ArchiveListSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-in fade-in duration-300">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <Skeleton className="h-4 flex-1 mr-4" />
          <div className="flex gap-1">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
