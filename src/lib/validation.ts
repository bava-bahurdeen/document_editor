import { z } from "zod";
import {  OperationType } from "@prisma/client";
type Role = "OWNER" | "EDITOR" | "VIEWER";

// Document validation
export const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  content: z.string().optional().default(""),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long").optional(),
  content: z.string().optional(),
});

// Permissions/Sharing validation
export const shareDocumentSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.string(),
});

export const removePermissionSchema = z.object({
  userId: z.string().cuid("Invalid User ID"),
});

// Operations validation for the sync engine
export const operationItemSchema = z.object({
  id: z.string().min(1, "Operation ID is required"),
  documentId: z.string().cuid("Invalid Document ID"),
  type: z.nativeEnum(OperationType),
  position: z.string(),
  value: z.string(),
  createdAt: z.string().or(z.date()).transform((val) => new Date(val)),
});

export const pushOperationsSchema = z.object({
  operations: z.array(operationItemSchema),
});

export const pullOperationsSchema = z.object({
  documentId: z.string().cuid("Invalid Document ID"),
  lastSyncedSequence: z
    .string()
    .optional()
    .default("0")
    .transform((val) => {
      try {
        return BigInt(val);
      } catch {
        return BigInt(0);
      }
    }),
});

// Snapshots / Versioning validation
export const createSnapshotSchema = z.object({
  isManual: z.boolean().optional().default(true),
});

export const restoreSnapshotSchema = z.object({
  snapshotId: z.string().cuid("Invalid Snapshot ID"),
});
