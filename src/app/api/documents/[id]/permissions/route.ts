import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitCheck } from "@/lib/rate-limit";
import { checkPermission } from "@/lib/authorization";
import { shareDocumentSchema, removePermissionSchema } from "@/lib/validation";

/**
 * POST /api/documents/[id]/permissions
 * Adds or updates permission role for a specific user, requiring OWNER permission.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = rateLimitCheck(ip);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Authorization: Only OWNER can manage permissions
    const isOwner = await checkPermission(id, session.user.id, "MANAGE_PERMISSIONS");
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden: Only owners can manage permissions" }, { status: 403 });
    }

    const body = await req.json();
    const result = shareDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.format() }, { status: 400 });
    }

    const { email, role } = result.data;

    // 2. Locate target user by email
    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User with this email address does not exist" }, { status: 404 });
    }

    // 3. Prevent modifying own ownership
    if (targetUser.id === session.user.id && role !== "OWNER") {
      // Ensure there is at least another owner or reject
      const ownersCount = await prisma.documentPermission.count({
        where: { documentId: id, role: "OWNER" },
      });
      if (ownersCount <= 1) {
        return NextResponse.json({ error: "Cannot downgrade your own role when you are the sole owner" }, { status: 400 });
      }
    }

    // 4. Upsert permission
    const updatedPermission = await prisma.documentPermission.upsert({
      where: {
        documentId_userId: {
          documentId: id,
          userId: targetUser.id,
        },
      },
      update: { role },
      create: {
        documentId: id,
        userId: targetUser.id,
        role,
      },
    });

    // 5. Audit Logging
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SHARE_DOCUMENT",
        details: JSON.stringify({ documentId: id, granteeId: targetUser.id, role }),
        ipAddress: ip,
      },
    });

    return NextResponse.json({
      message: "Permissions updated successfully",
      permission: {
        userId: updatedPermission.userId,
        role: updatedPermission.role,
      },
    });
  } catch (error) {
    console.error(`POST /api/documents/${id}/permissions error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[id]/permissions
 * Removes a user's permissions for a document, requiring OWNER permission.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = rateLimitCheck(ip);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Authorization: Only OWNER can manage permissions
    const isOwner = await checkPermission(id, session.user.id, "MANAGE_PERMISSIONS");
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden: Only owners can manage permissions" }, { status: 403 });
    }

    const body = await req.json();
    const result = removePermissionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.format() }, { status: 400 });
    }

    const { userId: targetUserId } = result.data;

    // 2. Verify target document owner fallback protection
    const document = await prisma.document.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.ownerId === targetUserId) {
      return NextResponse.json({ error: "Cannot revoke permissions of the document creator/owner" }, { status: 400 });
    }

    // 3. Remove permission record
    await prisma.documentPermission.delete({
      where: {
        documentId_userId: {
          documentId: id,
          userId: targetUserId,
        },
      },
    });

    // 4. Audit Logging
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REVOKE_PERMISSION",
        details: JSON.stringify({ documentId: id, revokedUserId: targetUserId }),
        ipAddress: ip,
      },
    });

    return NextResponse.json({ message: "Permissions revoked successfully" });
  } catch (error) {
    console.error(`DELETE /api/documents/${id}/permissions error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
