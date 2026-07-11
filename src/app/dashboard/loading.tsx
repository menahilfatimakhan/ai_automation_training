/** Skeleton shown while a dashboard segment streams in. */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-7 w-48 rounded" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-28 p-5">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton mt-3 h-7 w-32 rounded" />
            <div className="skeleton mt-4 h-1.5 w-full rounded" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card skeleton h-64 p-5" />
        <div className="card skeleton h-64 p-5" />
      </div>
    </div>
  );
}
