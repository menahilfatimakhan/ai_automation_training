import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { navFor } from "@/lib/access";
import { DashboardShell, type NavLink } from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const nav = navFor(ctx);
  const all: (NavLink & { show: boolean })[] = [
    { href: "/dashboard/master", label: "Master", icon: "master", show: nav.master },
    { href: "/dashboard/sales", label: "Sales", icon: "sales", show: nav.sales },
    { href: "/dashboard/setter", label: "Setter", icon: "setter", show: nav.setter },
    { href: "/dashboard/ads", label: "Ads", icon: "ads", show: nav.ads },
    { href: "/dashboard/call-logs", label: "Call Logs", icon: "callLogs", show: nav.callLogs },
    { href: "/dashboard/leads", label: "Leads", icon: "leads", show: nav.leads },
    { href: "/dashboard/admin", label: "Admin", icon: "admin", show: nav.admin },
  ];
  const links: NavLink[] = all
    .filter((l) => l.show)
    .map(({ href, label, icon }) => ({ href, label, icon }));

  const role = ctx.isAdmin ? "Admin" : ctx.memberships[0]?.role ?? "Member";

  return (
    <DashboardShell links={links} userLabel={`Signed in · ${role}`}>
      {children}
    </DashboardShell>
  );
}
