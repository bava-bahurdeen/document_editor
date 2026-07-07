import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitCheck } from "@/lib/rate-limit";
import { checkPermission } from "@/lib/authorization";
import { pushOperationsSchema } from "@/lib/validation";

/**
 * POST /api/sync/push
 * Receives an array of operations from the client, validates permissions,
 * and saves new operations in a single database transaction.
 */
export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const result = pushOperationsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.format() }, { status: 400 });
    }

    const { operations } = result.data;
    if (operations.length === 0) {
      return NextResponse.json({ pushedCount: 0, operations: [] });
    }

    // 1. Group operations by document ID to batch check permissions
    const docIds = Array.from(new Set(operations.map((o) => o.documentId)));
    for (const docId of docIds) {
      const isAuthorized = await checkPermission(docId, session.user.id, "EDIT");
      if (!isAuthorized) {
        return NextResponse.json(
          { error: `Forbidden: Edit permission required for document ${docId}` },
          { status: 403 }
        );
      }
    }

    // 2. Identify and filter out operations that already exist in the database (Idempotency check)
    const operationIds = operations.map((o) => o.id);
    const existingOps = await prisma.operation.findMany({
      where: { id: { in: operationIds } },
      select: { id: true },
    });
    const existingSet = new Set(existingOps.map((o) => o.id));
    const newOps = operations.filter((o) => !existingSet.has(o.id));

    if (newOps.length === 0) {
      return NextResponse.json({ pushedCount: 0, operations: [] });
    }

    // 3. Insert new operations inside a transaction to assign sequences
    const savedOps = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const op of newOps) {
        const saved = await tx.operation.create({
          data: {
            id: op.id,
            documentId: op.documentId,
            userId: session.user.id,
            type: op.type,
            position: op.position,
            value: op.value,
            createdAt: op.createdAt,
          },
        });
        results.push(saved);
      }

      // Update the updatedAt timestamp of the documents
      for (const docId of docIds) {
        await tx.document.update({
          where: { id: docId },
          data: { updatedAt: new Date() },
        });
      }

      return results;
    });

    return NextResponse.json({
      pushedCount: savedOps.length,
      operations: savedOps.map((op) => ({
        id: op.id,
        documentId: op.documentId,
        sequence: op.sequence.toString(), // Convert BigInt to string to avoid JSON errors
      })),
    });
  } catch (error) {
    console.error("POST /api/sync/push error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
