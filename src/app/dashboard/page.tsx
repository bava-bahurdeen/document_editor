import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import DashboardContent from "@/components/dashboard/DashboardContent";

export const metadata = {
  title: "Dashboard | Collaborative Editor",
  description: "View and manage your collaborative document workspaces.",
};

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Server-Side Page Route: /dashboard
 * Fetches authorization context and passes profile information down to DashboardContent.
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token || !JWT_SECRET) {
    redirect("/login");
  }

  let userId: string;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    userId = payload.sub as string;
  } catch (error) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!dbUser) {
    redirect("/login");
  }

  const user = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    image: dbUser.image,
  };

  return <DashboardContent user={user} />;
}