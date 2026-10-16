/** Shared skeleton block. `aria-hidden` because a screen reader should get the live message, not the shapes. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-[#111a1f] ${className}`} />
}

/**
 * Route-level loading state. The visible text is announced once through the
 * status role; the placeholder blocks themselves stay hidden from assistive tech.
 */
export function LoadingScreen({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div className="space-y-7">
      <p role="status" className="sr-only">{label}</p>
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[124px]" />)}
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-11" />)}
      </div>
    </div>
  )
}
