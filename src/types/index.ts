export type UserRole = "OWNER" | "EDITOR" | "VIEWER";

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface Document {
  id: string;
  title: string;
  content: string; // Serialized editor content (JSON string or HTML)
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentPermission {
  id: string;
  documentId: string;
  userId: string;
  role: UserRole;
  createdAt: Date;
}

export interface Operation {
  id: string; // unique client-side Lamport timestamp e.g. "clientId:seq"
  documentId: string;
  userId: string;
  type: "INSERT" | "DELETE" | "UPDATE_TITLE";
  position: string; // Fractional index representation
  value: string; // String or JSON character data
  sequence?: string; // Global DB auto-increment sequence (used for server synchronization)
  createdAt: Date;
}

export interface Snapshot {
  id: string;
  documentId: string;
  userId: string;
  content: string; // full document JSON string at snapshot time
  sequence: string; // operations sequence number up to which this snapshot is valid
  versionNumber: number;
  isManual: boolean;
  createdAt: Date;
}

export interface SyncQueueItem {
  id?: number; // local auto-increment key in IndexedDB
  documentId: string;
  operationId: string;
  type: "INSERT" | "DELETE" | "UPDATE_TITLE";
  position: string;
  value: string;
  createdAt: number;
}

export interface SyncMetadata {
  key: string; // e.g., "last_synced_seq_[documentId]"
  value: string;
}
