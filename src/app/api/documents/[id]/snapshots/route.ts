import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitCheck } from "@/lib/rate-limit";
import { checkPermission } from "@/lib/authorization";
import { createSnapshotSchema } from "@/lib/validation";

/**
 * GET /api/documents/[id]/snapshots
 * Lists all snapshots/versions for a document, requiring VIEW_HISTORY permission.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const isAuthorized = await checkPermission(id, session.user.id, "VIEW_HISTORY");
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: View history permission required" }, { status: 403 });
    }

    const snapshots = await prisma.snapshot.findMany({
      where: { documentId: id },
      orderBy: { versionNumber: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      snapshots: snapshots.map((s) => ({
        id: s.id,
        versionNumber: s.versionNumber,
        sequence: s.sequence.toString(),
        isManual: s.isManual,
        content: s.content,
        createdAt: s.createdAt,
        creator: {
          name: s.user.name,
          email: s.user.email,
        },
      })),
    });
  } catch (error) {
    console.error(`GET /api/documents/${id}/snapshots error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/documents/[id]/snapshots
 * Creates a new document snapshot, requiring CREATE_VERSION permission.
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
    const isAuthorized = await checkPermission(id, session.user.id, "CREATE_VERSION");
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: Edit permission required to create snapshots" }, { status: 403 });
    }

    const body = await req.json();
    const result = createSnapshotSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.format() }, { status: 400 });
    }

    const { isManual } = result.data;

    // Retrieve document content and max operation sequence
    const document = await prisma.document.findUnique({
      where: { id },
      select: { content: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const maxOp = await prisma.operation.findFirst({
      where: { documentId: id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const lastSeq = maxOp?.sequence ?? BigInt(0);

    // Prevent duplicate snapshots: check if the latest snapshot matches the current sequence
    const latestSnapshot = await prisma.snapshot.findFirst({
      where: { documentId: id },
      orderBy: { versionNumber: "desc" },
    });

    if (latestSnapshot && latestSnapshot.sequence === lastSeq) {
      return NextResponse.json(
        {
          id: latestSnapshot.id,
          versionNumber: latestSnapshot.versionNumber,
          sequence: latestSnapshot.sequence.toString(),
          isManual: latestSnapshot.isManual,
          createdAt: latestSnapshot.createdAt,
          message: "Snapshot is already up-to-date",
        },
        { status: 200 }
      );
    }

    const snapshotCount = await prisma.snapshot.count({
      where: { documentId: id },
    });

    const newSnapshot = await prisma.snapshot.create({
      data: {
        documentId: id,
        userId: session.user.id,
        content: document.content,
        sequence: lastSeq,
        versionNumber: snapshotCount + 1,
        isManual,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_SNAPSHOT",
        details: JSON.stringify({
          documentId: id,
          snapshotId: newSnapshot.id,
          versionNumber: newSnapshot.versionNumber,
          isManual,
        }),
        ipAddress: ip,
      },
    });

    return NextResponse.json(
      {
        id: newSnapshot.id,
        versionNumber: newSnapshot.versionNumber,
        sequence: newSnapshot.sequence.toString(),
        isManual: newSnapshot.isManual,
        createdAt: newSnapshot.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`POST /api/documents/${id}/snapshots error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
