import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitCheck } from "@/lib/rate-limit";
import { checkPermission } from "@/lib/authorization";
import { pullOperationsSchema } from "@/lib/validation";

/**
 * GET /api/sync/pull
 * Retrieves operations for a document that occurred after a given sequence cursor,
 * requiring READ permission.
 */
export async function GET(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);
    const query = {
      documentId: searchParams.get("documentId"),
      lastSyncedSequence: searchParams.get("lastSyncedSequence") || "0",
    };

    const result = pullOperationsSchema.safeParse(query);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid parameters", details: result.error.format() }, { status: 400 });
    }

    const { documentId, lastSyncedSequence } = result.data;

    // 1. Authorization: User needs READ permission
    const isAuthorized = await checkPermission(documentId, session.user.id, "READ");
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: Read permission required" }, { status: 403 });
    }

    // 2. Fetch operations committed after lastSyncedSequence
    const operations = await prisma.operation.findMany({
      where: {
        documentId,
        sequence: {
          gt: lastSyncedSequence,
        },
      },
      orderBy: {
        sequence: "asc",
      },
    });

    return NextResponse.json({
      operations: operations.map((op) => ({
        id: op.id,
        documentId: op.documentId,
        userId: op.userId,
        type: op.type,
        position: op.position,
        value: op.value,
        sequence: op.sequence.toString(), // Convert BigInt to string
        createdAt: op.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/sync/pull error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
