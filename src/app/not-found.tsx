import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="text-sm font-medium text-brand">404</span>
      <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-ink-soft">
        The page you’re looking for doesn’t exist.
      </p>
      <Link href="/dashboard" className="btn-primary mt-6">
        Go to dashboard
      </Link>
    </main>
  );
}
