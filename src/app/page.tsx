import { redirect } from "next/navigation";

export default function Home() {
  // Send visitors straight into the app; middleware bounces unauthenticated
  // users to /login, and /dashboard routes each role to its landing page.
  redirect("/dashboard");
}
