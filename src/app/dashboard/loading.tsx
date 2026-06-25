/** Skeleton shown while a dashboard segment streams in. */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-48 rounded bg-surface-raised" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-28 p-5">
            <div className="h-3 w-24 rounded bg-surface-raised" />
            <div className="mt-3 h-7 w-32 rounded bg-surface-raised" />
            <div className="mt-4 h-1.5 w-full rounded bg-surface-raised" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card h-64 p-5" />
        <div className="card h-64 p-5" />
      </div>
    </div>
  );
}
