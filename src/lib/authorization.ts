import "server-only";
import { prisma } from "@/lib/db";
type Role = "OWNER" | "EDITOR" | "VIEWER" | string;

export type DocumentAction =
  | "READ"
  | "EDIT"
  | "DELETE"
  | "SHARE"
  | "MANAGE_PERMISSIONS"
  | "RESTORE_VERSION"
  | "CREATE_VERSION"
  | "VIEW_HISTORY";

const ROLE_PERMISSIONS: Record<Role, DocumentAction[]> = {
  OWNER: [
    "READ",
    "EDIT",
    "DELETE",
    "SHARE",
    "MANAGE_PERMISSIONS",
    "RESTORE_VERSION",
    "CREATE_VERSION",
    "VIEW_HISTORY",
  ],
  EDITOR: ["READ", "EDIT", "CREATE_VERSION", "VIEW_HISTORY"],
  VIEWER: ["READ"],
};

/**
 * Resolves the role of a user for a specific document.
 * Checks the DocumentPermission table, and falls back to checking the Document.ownerId.
 */
export async function getPermissionRole(documentId: string, userId: string): Promise<Role | null> {
  try {
    // 1. Query the direct permissions mapping
    const permission = await prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });

    if (permission) {
      return permission.role;
    }

    // 2. Fallback check: check if the user is the explicit owner of the document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { ownerId: true },
    });

    if (document && document.ownerId === userId) {
      return "OWNER";
    }

    return null;
  } catch (error) {
    console.error("Error fetching permission role:", error);
    return null;
  }
}

/**
 * Checks if a user has permission to perform a specific action on a document.
 */
export async function checkPermission(
  documentId: string,
  userId: string,
  action: DocumentAction
): Promise<boolean> {
  const role = await getPermissionRole(documentId, userId);
  if (!role) {
    return false;
  }

  const allowedActions = ROLE_PERMISSIONS[role];
  return allowedActions.includes(action);
}

/**
 * Validates permission and returns authorization details, returning false and null if unauthorized.
 */
export async function authorizeUser(
  documentId: string,
  userId: string,
  action: DocumentAction
): Promise<{ authorized: boolean; role: Role | null }> {
  const role = await getPermissionRole(documentId, userId);
  if (!role) {
    return { authorized: false, role: null };
  }

  const allowedActions = ROLE_PERMISSIONS[role];
  const authorized = allowedActions.includes(action);

  return { authorized, role };
}
