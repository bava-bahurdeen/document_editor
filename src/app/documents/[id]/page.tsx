import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPermissionRole } from "@/lib/authorization";
import { redirect } from "next/navigation";
import Link from "next/link";
import TiptapEditor from "@/components/editor/TiptapEditor";
import WorkspaceSidebar from "@/components/editor/WorkspaceSidebar";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { ChevronLeft } from "lucide-react";
import { Role } from "@prisma/client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Editor | Collaborative Workspace",
  description: "Collaborative, offline-first rich text document workspace.",
};

/**
 * Server-Side Document Workspace Route: /documents/[id]
 * Validates authentication, enforces role authorization, and sets up editor/sidebar.
 */
export default async function DocumentPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Authentication Check
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // 2. Resolve document and permissions
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      permissions: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    redirect("/dashboard");
  }

  // 3. Enforce Server-Side Authorization
  const userRole = await getPermissionRole(id, session.user.id);
  if (!userRole) {
    // Return unauthorized redirect
    redirect("/dashboard");
  }

  // Map collaborators list
  const formattedPermissions = document.permissions.map((p) => ({
    userId: p.userId,
    email: p.user.email,
    name: p.user.name,
    role: p.role as Role,
  }));

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Document Workspace Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md h-14 flex items-center px-4 flex-shrink-0 justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all border border-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="w-px h-5 bg-slate-800" />
          <span className="text-xs text-slate-500 font-medium">Document ID: {document.id}</span>
        </div>
      </header>

      {/* Side-by-side Editor & Sidebar Area wrapped in Error Boundary */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 overflow-hidden p-6">
          <ErrorBoundary>
            <TiptapEditor documentId={id} userId={session.user.id} role={userRole} />
          </ErrorBoundary>
        </div>

        <ErrorBoundary>
          <WorkspaceSidebar
            documentId={id}
            currentUserId={session.user.id}
            role={userRole}
            currentContent={document.content} // Baseline content for diff computation
            permissions={formattedPermissions}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
