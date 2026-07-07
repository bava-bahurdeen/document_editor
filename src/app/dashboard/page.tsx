import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardContent from "@/components/dashboard/DashboardContent";

export const metadata = {
  title: "Dashboard | Collaborative Editor",
  description: "View and manage your collaborative document workspaces.",
};

/**
 * Server-Side Page Route: /dashboard
 * Fetches authorization context and passes profile information down to DashboardContent.
 */
export default async function DashboardPage() {
  const session = await auth();

  // Redirect to login if user is not authenticated
  if (!session?.user) {
    redirect("/login");
  }

  // Map session user info safely
  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };

  return <DashboardContent user={user} />;
}
