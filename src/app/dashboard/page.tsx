import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { landingRoute } from "@/lib/access";

export default async function DashboardIndex() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  redirect(landingRoute(ctx));
}
