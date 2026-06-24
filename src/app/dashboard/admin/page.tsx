import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

// Placeholder — built out in Step 9 (Admin settings). Admin-only.
export default async function AdminPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.isAdmin) redirect("/dashboard");
  return <h1 className="text-xl font-semibold">Admin settings</h1>;
}
