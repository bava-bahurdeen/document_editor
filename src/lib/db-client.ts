import Dexie, { type Table } from "dexie";
import { Document, Operation, Snapshot, SyncQueueItem, UserRole } from "@/types";

// Extends Document type for offline use with role
export interface OfflineDocument extends Document {
  role?: UserRole;
}

export class OfflineDatabase extends Dexie {
  documents!: Table<OfflineDocument, string>;
  operations!: Table<Operation, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  snapshots!: Table<Snapshot, string>;
  metadata!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("DocumentEditorOfflineDB");

    // Table schemas and indexes
    // ++id represents auto-increment primary key
    // [documentId+position] is a compound index for fast ordering of CRDT elements
    this.version(1).stores({
      documents: "id, ownerId, updatedAt",
      operations: "id, documentId, userId, type, position, [documentId+position]",
      syncQueue: "++id, documentId, operationId",
      snapshots: "id, documentId, versionNumber, createdAt",
      metadata: "key",
    });
  }
}

// Export database singleton instance for client-side use
export const db = typeof window !== "undefined" ? new OfflineDatabase() : (null as unknown as OfflineDatabase);

// ==========================================
// OFFLINE REPOSITORY HELPERS
// ==========================================

/**
 * Saves a document's metadata and content cache to IndexedDB.
 */
export async function saveDocumentLocally(doc: OfflineDocument): Promise<void> {
  if (!db) return;
  await db.documents.put({
    ...doc,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  });
}

/**
 * Retrieves a document from the local IndexedDB cache.
 */
export async function getDocumentLocally(id: string): Promise<OfflineDocument | undefined> {
  if (!db) return undefined;
  return await db.documents.get(id);
}

/**
 * Saves an edit operation to the local log in IndexedDB.
 */
export async function saveOperationLocally(op: Operation): Promise<void> {
  if (!db) return;
  await db.operations.put({
    ...op,
    createdAt: new Date(op.createdAt),
  });
}

/**
 * Adds an operation to the pending sync queue in IndexedDB.
 */
export async function queueOperationForSync(
  documentId: string,
  op: Operation
): Promise<number> {
  if (!db) return 0;
  return await db.syncQueue.add({
    documentId,
    operationId: op.id,
    type: op.type,
    position: op.position,
    value: op.value,
    createdAt: Date.now(),
  });
}

/**
 * Retrieves all pending operations in the sync queue for a document, sorted by queue order.
 */
export async function getPendingOperations(documentId: string): Promise<SyncQueueItem[]> {
  if (!db) return [];
  return await db.syncQueue.where("documentId").equals(documentId).toArray();
}

/**
 * Removes a successfully synchronized item from the local sync queue.
 */
export async function clearPendingOperation(id: number): Promise<void> {
  if (!db) return;
  await db.syncQueue.delete(id);
}

/**
 * Gets the last-known global database sequence cursor for a document.
 */
export async function getLastSyncedSequence(documentId: string): Promise<string> {
  if (!db) return "0";
  const item = await db.metadata.get(`last_synced_seq_${documentId}`);
  return item ? item.value : "0";
}

/**
 * Sets the last-known global database sequence cursor for a document.
 */
export async function setLastSyncedSequence(documentId: string, sequence: string): Promise<void> {
  if (!db) return;
  await db.metadata.put({
    key: `last_synced_seq_${documentId}`,
    value: sequence,
  });
}

/**
 * Retrieves all operations for a document sorted by position for CRDT reconstruction.
 */
export async function getDocumentOperations(documentId: string): Promise<Operation[]> {
  if (!db) return [];
  return await db.operations.where("documentId").equals(documentId).sortBy("position");
}

/**
 * Saves a document snapshot locally.
 */
export async function saveSnapshotLocally(snapshot: Snapshot): Promise<void> {
  if (!db) return;
  await db.snapshots.put({
    ...snapshot,
    createdAt: new Date(snapshot.createdAt),
  });
}

/**
 * Retrieves all locally cached snapshots for a document.
 */
export async function getSnapshotsLocally(documentId: string): Promise<Snapshot[]> {
  if (!db) return [];
  return await db.snapshots
    .where("documentId")
    .equals(documentId)
    .reverse()
    .sortBy("versionNumber");
}
