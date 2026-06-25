"use client";

import { useEffect } from "react";

/** Graceful error boundary for dashboard routes (data/AI/sync failures). */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-soft">
        This view failed to load. It may be a transient data or network issue.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/dashboard" className="btn-ghost">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
