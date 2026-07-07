import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitCheck } from "@/lib/rate-limit";
import { checkPermission } from "@/lib/authorization";
import { restoreSnapshotSchema } from "@/lib/validation";

/**
 * POST /api/documents/[id]/snapshots/restore
 * Restores a document's content to a specific snapshot, requiring OWNER permission.
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
    // 1. Authorization: Only OWNER can restore versions
    const isOwner = await checkPermission(id, session.user.id, "RESTORE_VERSION");
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden: Only owners can restore document snapshots" }, { status: 403 });
    }

    const body = await req.json();
    const result = restoreSnapshotSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.format() }, { status: 400 });
    }

    const { snapshotId } = result.data;

    // 2. Perform restore operations inside a transaction
    const restoredDoc = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.snapshot.findUnique({
        where: { id: snapshotId },
      });

      if (!snapshot || snapshot.documentId !== id) {
        throw new Error("Target snapshot not found or does not belong to this document");
      }

      // Update the document content
      const updatedDoc = await tx.document.update({
        where: { id },
        data: {
          content: snapshot.content,
          updatedAt: new Date(),
        },
      });

      return updatedDoc;
    });

    // 3. Write security audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "RESTORE_SNAPSHOT",
        details: JSON.stringify({ documentId: id, snapshotId, versionNumber: restoredDoc.content }), // content is JSON
        ipAddress: ip,
      },
    });

    return NextResponse.json({
      message: "Document successfully restored to selected version",
      document: {
        id: restoredDoc.id,
        title: restoredDoc.title,
        content: restoredDoc.content,
        updatedAt: restoredDoc.updatedAt,
      },
    });
  } catch (error: any) {
    console.error(`POST /api/documents/${id}/snapshots/restore error:`, error);
    const msg = error.message || "Internal Server Error";
    const status = error.message === "Target snapshot not found or does not belong to this document" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
