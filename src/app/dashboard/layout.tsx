import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import { navFor } from "@/lib/access";
import { signOut } from "@/app/auth/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const nav = navFor(ctx);
  const links: { href: string; label: string; show: boolean }[] = [
    { href: "/dashboard/master", label: "Master", show: nav.master },
    { href: "/dashboard/sales", label: "Sales", show: nav.sales },
    { href: "/dashboard/setter", label: "Setter", show: nav.setter },
    { href: "/dashboard/ads", label: "Ads", show: nav.ads },
    { href: "/dashboard/call-logs", label: "Call Logs", show: nav.callLogs },
    { href: "/dashboard/admin", label: "Admin", show: nav.admin },
  ];

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-bold text-brand">NEW SZN</span>
          <nav className="flex gap-4 text-sm text-neutral-300">
            {links
              .filter((l) => l.show)
              .map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              ))}
          </nav>
        </div>
        <form action={signOut}>
          <button className="text-sm text-neutral-400 hover:text-white">
            Sign out
          </button>
        </form>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
