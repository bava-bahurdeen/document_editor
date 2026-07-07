import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitCheck } from "@/lib/rate-limit";
import { createDocumentSchema } from "@/lib/validation";

/**
 * GET /api/documents
 * List all documents accessible by the active user with search, filter, and pagination support.
 */
export async function GET(req: NextRequest) {
  // 1. Rate Limiting Check
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = rateLimitCheck(ip);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // 2. Authentication Check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    // Find documents the user owns or has explicit permission for
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { ownerId: session.user.id },
          {
            permissions: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
        title: q
          ? {
              contains: q,
              mode: "insensitive",
            }
          : undefined,
      },
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        permissions: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    const total = await prisma.document.count({
      where: {
        OR: [
          { ownerId: session.user.id },
          {
            permissions: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
        title: q
          ? {
              contains: q,
              mode: "insensitive",
            }
          : undefined,
      },
    });

    // Map response and append calculated client-side role
    const formattedDocs = documents.map((doc) => {
      const explicitRole = doc.permissions[0]?.role;
      const role = doc.ownerId === session.user.id ? "OWNER" : explicitRole || "VIEWER";
      return {
        id: doc.id,
        title: doc.title,
        ownerId: doc.ownerId,
        role,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    return NextResponse.json({
      documents: formattedDocs,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/documents
 * Create a new document and automatically configure OWNER roles for the creator.
 */
export async function POST(req: NextRequest) {
  // 1. Rate Limiting Check
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = rateLimitCheck(ip);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // 2. Authentication Check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = createDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.format() }, { status: 400 });
    }

    const { title, content } = result.data;

    // Transactionally create the document and assign owner permission
    const newDoc = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          title,
          content,
          ownerId: session.user.id,
        },
      });

      await tx.documentPermission.create({
        data: {
          documentId: doc.id,
          userId: session.user.id,
          role: "OWNER",
        },
      });

      return doc;
    });

    // Write security audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_DOCUMENT",
        details: JSON.stringify({ documentId: newDoc.id, title: newDoc.title }),
        ipAddress: ip,
      },
    });

    return NextResponse.json(
      {
        id: newDoc.id,
        title: newDoc.title,
        role: "OWNER",
        createdAt: newDoc.createdAt,
        updatedAt: newDoc.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/documents error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
