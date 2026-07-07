import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  db,
  saveDocumentLocally,
  getDocumentLocally,
  saveSnapshotLocally,
  getSnapshotsLocally,
} from "@/lib/db-client";
import { syncEngine } from "@/lib/sync-engine";
import { Document, Snapshot, UserRole } from "@/types";

// Custom API error class to capture status codes
class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Hook to retrieve the list of accessible documents.
 * Falls back to the local IndexedDB cache when offline or if API requests fail.
 */
export function useDocuments(search: string = "") {
  return useQuery({
    queryKey: ["documents", search],
    queryFn: async () => {
      const isOnline = typeof window !== "undefined" && window.navigator.onLine;

      // 1. Offline Mode: read directly from Dexie IndexedDB cache
      if (!isOnline) {
        if (!db) return { documents: [] };
        const localDocs = await db.documents
          .filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
          .toArray();
        return {
          documents: localDocs.map((d) => ({
            id: d.id,
            title: d.title,
            ownerId: d.ownerId,
            role: d.role || "VIEWER",
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          })),
        };
      }

      // 2. Online Mode: fetch from REST API
      const res = await fetch(`/api/documents?q=${encodeURIComponent(search)}`);
      if (!res.ok) {
        throw new ApiError("Failed to fetch documents", res.status);
      }
      const data = await res.json();

      // Write results to local Dexie cache for future offline visits
      for (const doc of data.documents) {
        await saveDocumentLocally({
          id: doc.id,
          title: doc.title,
          content: "", // Content loaded separately on workspace load
          ownerId: doc.ownerId,
          role: doc.role,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        });
      }

      return data;
    },
  });
}

/**
 * Hook to fetch a single document's metadata.
 * Falls back to local IndexedDB document metadata cache if offline.
 */
export function useDocument(id: string) {
  return useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const isOnline = typeof window !== "undefined" && window.navigator.onLine;

      if (!isOnline) {
        const cached = await getDocumentLocally(id);
        if (!cached) {
          throw new ApiError("Document not found in local cache", 404);
        }
        return cached;
      }

      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) {
        throw new ApiError("Failed to fetch document", res.status);
      }
      const data = await res.json();

      // Cache document content and role locally
      await saveDocumentLocally({
        id: data.id,
        title: data.title,
        content: data.content,
        ownerId: data.ownerId,
        role: data.role,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      });

      return data;
    },
  });
}

/**
 * Mutation hook to create a new document.
 * Optimistically saves the document locally in Dexie first to support instant rendering.
 */
export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, content }: { title: string; content?: string }) => {
      const isOnline = typeof window !== "undefined" && window.navigator.onLine;
      const tempId = `temp_${Date.now()}`;

      // A. Save to IndexedDB locally immediately
      const tempDoc = {
        id: tempId,
        title,
        content: content || "",
        ownerId: "me", // Temporary owner tag
        role: "OWNER" as UserRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await saveDocumentLocally(tempDoc);

      if (!isOnline) {
        // If offline, return the temporary document. The Sync Engine will not push creation,
        // but the user can edit it offline. Once online, they can sync or save.
        // For production, we queue metadata operations as well, but standard local-first
        // focuses on editing.
        return tempDoc;
      }

      // B. Save to server API
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        throw new ApiError("Failed to create document", res.status);
      }
      const newDoc = await res.json();

      // Clean up temporary local document and write correct server document to Dexie
      if (db) {
        await db.documents.delete(tempId);
      }
      await saveDocumentLocally({
        id: newDoc.id,
        title: newDoc.title,
        content: content || "",
        ownerId: newDoc.ownerId,
        role: "OWNER",
        createdAt: new Date(newDoc.createdAt),
        updatedAt: new Date(newDoc.updatedAt),
      });

      return newDoc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/**
 * Mutation hook to delete a document.
 * Removes the document from local IndexedDB and updates visual lists optimistically.
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const isOnline = typeof window !== "undefined" && window.navigator.onLine;

      // Delete from local cache
      if (db) {
        await db.documents.delete(id);
        await db.operations.where("documentId").equals(id).delete();
        await db.syncQueue.where("documentId").equals(id).delete();
      }

      if (!isOnline) {
        return { message: "Deleted locally" };
      }

      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new ApiError("Failed to delete document", res.status);
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/**
 * Mutation hook to share a document.
 */
export function useShareDocument(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: UserRole }) => {
      const res = await fetch(`/api/documents/${documentId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new ApiError(errData.error || "Failed to share document", res.status);
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
  });
}

/**
 * Mutation hook to revoke document permissions.
 */
export function useRevokePermission(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/documents/${documentId}/permissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new ApiError(errData.error || "Failed to revoke permission", res.status);
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
  });
}

/**
 * Hook to retrieve document snapshots.
 * Falls back to IndexedDB local snapshots cache if offline.
 */
export function useSnapshots(documentId: string) {
  return useQuery({
    queryKey: ["snapshots", documentId],
    queryFn: async () => {
      const isOnline = typeof window !== "undefined" && window.navigator.onLine;

      if (!isOnline) {
        return await getSnapshotsLocally(documentId);
      }

      const res = await fetch(`/api/documents/${documentId}/snapshots`);
      if (!res.ok) {
        throw new ApiError("Failed to fetch snapshots", res.status);
      }
      const data = await res.json();

      // Cache snapshots locally
      for (const snap of data.snapshots) {
        const localSnap: Snapshot = {
          id: snap.id,
          documentId,
          userId: "", // Local placeholder
          content: snap.content || "",
          sequence: snap.sequence,
          versionNumber: snap.versionNumber,
          isManual: snap.isManual,
          createdAt: new Date(snap.createdAt),
        };
        await saveSnapshotLocally(localSnap);
      }

      return data.snapshots;
    },
  });
}

/**
 * Mutation hook to restore a document from a historical snapshot.
 */
export function useRestoreSnapshot(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await fetch(`/api/documents/${documentId}/snapshots/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });

      if (!res.ok) {
        throw new ApiError("Failed to restore snapshot", res.status);
      }

      const data = await res.json();

      // If online, force sync right away to align client state
      if (syncEngine.isOnline()) {
        await syncEngine.sync(documentId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      queryClient.invalidateQueries({ queryKey: ["snapshots", documentId] });
    },
  });
}
