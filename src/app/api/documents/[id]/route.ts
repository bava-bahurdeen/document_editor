import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitCheck } from "@/lib/rate-limit";
import { checkPermission, getPermissionRole } from "@/lib/authorization";
import { updateDocumentSchema } from "@/lib/validation";

/**
 * GET /api/documents/[id]
 * Retrieves the document metadata and content, requiring READ permission.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const isAuthorized = await checkPermission(id, session.user.id, "READ");
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: Access denied" },
        { status: 403 },
      );
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        permissions: {
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const userRole = await getPermissionRole(id, session.user.id);

    return NextResponse.json({
      id: document.id,
      title: document.title,
      content: document.content,
      ownerId: document.ownerId,
      role: userRole,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      permissions: document?.permissions?.map((p: any) => ({
        userId: p?.userId,
        email: p?.user?.email,
        name: p?.user?.name,
        role: p?.role,
      })),
    });
  } catch (error) {
    console.error(`GET /api/documents/${id} error:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/documents/[id]
 * Updates document details (title, content), requiring EDIT permission.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const isAuthorized = await checkPermission(id, session.user.id, "EDIT");
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: Edit permission required" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const result = updateDocumentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.format() },
        { status: 400 },
      );
    }

    const { title, content } = result.data;

    const updatedDoc = await prisma.document.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        content: content !== undefined ? content : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_DOCUMENT",
        details: JSON.stringify({
          documentId: id,
          updatedFields: {
            title: title !== undefined,
            content: content !== undefined,
          },
        }),
        ipAddress: ip,
      },
    });

    return NextResponse.json({
      id: updatedDoc.id,
      title: updatedDoc.title,
      updatedAt: updatedDoc.updatedAt,
    });
  } catch (error) {
    console.error(`PATCH /api/documents/${id} error:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/documents/[id]
 * Deletes a document, requiring OWNER permission.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const isAuthorized = await checkPermission(id, session.user.id, "DELETE");
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: Only owners can delete documents" },
        { status: 403 },
      );
    }

    await prisma.document.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_DOCUMENT",
        details: JSON.stringify({ documentId: id }),
        ipAddress: ip,
      },
    });

    return NextResponse.json({ message: "Document successfully deleted" });
  } catch (error) {
    console.error(`DELETE /api/documents/${id} error:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
