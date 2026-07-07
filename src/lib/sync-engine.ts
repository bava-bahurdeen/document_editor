import { Operation } from "@/types";
import {
  clearPendingOperation,
  db,
  getLastSyncedSequence,
  getPendingOperations,
  saveOperationLocally,
  setLastSyncedSequence,
} from "./db-client";

type SyncCallback = (newOps: Operation[]) => void;

class SyncEngine {
  private activeDocumentId: string | null = null;
  private isSyncingMap = new Map<string, boolean>();
  private callbacks = new Map<string, Set<SyncCallback>>();
  private onlineStatus: boolean = typeof window !== "undefined" ? window.navigator.onLine : true;
  private pollIntervalId: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      // 1. Connection change triggers
      window.addEventListener("online", () => this.handleConnectionChange(true));
      window.addEventListener("offline", () => this.handleConnectionChange(false));
      
      // 2. Start global polling loop for active documents
      this.startPollingLoop();
    }
  }

  private handleConnectionChange(isOnline: boolean) {
    this.onlineStatus = isOnline;
    console.log(`[SyncEngine] Device went ${isOnline ? "ONLINE" : "OFFLINE"}`);
    if (isOnline && this.activeDocumentId) {
      this.sync(this.activeDocumentId).catch(console.error);
    }
  }

  public isOnline(): boolean {
    return this.onlineStatus;
  }

  /**
   * Sets the active document ID being edited.
   * Instantly runs a sync cycles if online.
   */
  public setActiveDocument(documentId: string | null) {
    this.activeDocumentId = documentId;
    if (documentId && this.onlineStatus) {
      this.sync(documentId).catch(console.error);
    }
  }

  /**
   * Registers a callback to be triggered when remote operations are pulled and merged.
   */
  public subscribe(documentId: string, cb: SyncCallback) {
    if (!this.callbacks.has(documentId)) {
      this.callbacks.set(documentId, new Set());
    }
    this.callbacks.get(documentId)!.add(cb);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.get(documentId)?.delete(cb);
    };
  }

  private notify(documentId: string, ops: Operation[]) {
    const documentCallbacks = this.callbacks.get(documentId);
    if (documentCallbacks) {
      documentCallbacks.forEach((cb) => cb(ops));
    }
  }

  /**
   * Starts a background polling loop that triggers a sync check every 10 seconds.
   */
  private startPollingLoop() {
    if (this.pollIntervalId) return;
    this.pollIntervalId = setInterval(() => {
      if (this.activeDocumentId && this.onlineStatus) {
        this.sync(this.activeDocumentId).catch((err) => {
          console.error("[SyncEngine] Auto-sync poll error:", err);
        });
      }
    }, 10000); // 10 seconds interval
  }

  /**
   * Syncs local changes to the server and pulls remote changes from the server.
   * Utilizes lock-states to prevent concurrent race conditions.
   */
  public async sync(documentId: string): Promise<void> {
    if (!db) return;

    // Race condition prevention: exit if sync is already running for this document
    if (this.isSyncingMap.get(documentId)) {
      return;
    }

    if (!this.onlineStatus) {
      return;
    }

    this.isSyncingMap.set(documentId, true);

    try {
      // Phase A: Push local pending operations
      await this.pushPendingOperations(documentId);

      // Phase B: Pull remote operations
      await this.pullRemoteOperations(documentId);
    } catch (error) {
      console.error(`[SyncEngine] Sync failed for document ${documentId}:`, error);
      throw error;
    } finally {
      this.isSyncingMap.set(documentId, false);
    }
  }

  /**
   * Pushes local pending operations to the central server.
   */
  private async pushPendingOperations(documentId: string): Promise<void> {
    if (!db) return;

    const pending = await getPendingOperations(documentId);
    if (pending.length === 0) {
      return;
    }

    // Map pending items to operation log details
    const opsToPush = [];
    for (const item of pending) {
      const opDetail = await db.operations.get(item.operationId);
      if (opDetail) {
        opsToPush.push({
          id: opDetail.id,
          documentId: opDetail.documentId,
          type: opDetail.type,
          position: opDetail.position,
          value: opDetail.value,
          createdAt: opDetail.createdAt.toISOString(),
        });
      }
    }

    if (opsToPush.length === 0) {
      // Clear phantom/orphaned queue rows
      for (const item of pending) {
        if (item.id !== undefined) await clearPendingOperation(item.id);
      }
      return;
    }

    const response = await fetch("/api/sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operations: opsToPush }),
    });

    if (!response.ok) {
      throw new Error(`Push request failed with HTTP ${response.status}`);
    }

    const result = await response.json();

    // Remove successfully pushed items from sync queue
    const pushedOpIds = new Set(result.operations.map((o: any) => o.id));
    for (const item of pending) {
      if (pushedOpIds.has(item.operationId) && item.id !== undefined) {
        await clearPendingOperation(item.id);
      }
    }
  }

  /**
   * Pulls remote operations committed after the client's last-known sequence checkpoint.
   */
  private async pullRemoteOperations(documentId: string): Promise<void> {
    if (!db) return;

    const lastSeq = await getLastSyncedSequence(documentId);

    const response = await fetch(
      `/api/sync/pull?documentId=${documentId}&lastSyncedSequence=${lastSeq}`
    );

    if (!response.ok) {
      throw new Error(`Pull request failed with HTTP ${response.status}`);
    }

    const { operations } = await response.json();
    if (operations.length === 0) {
      return;
    }

    const newRemoteOps: Operation[] = [];
    let maxSequence = BigInt(lastSeq);

    for (const op of operations) {
      const opSeq = BigInt(op.sequence);
      if (opSeq > maxSequence) {
        maxSequence = opSeq;
      }

      // Idempotency: verify if the operation is already stored locally
      const existing = await db.operations.get(op.id);
      if (!existing) {
        const remoteOp: Operation = {
          id: op.id,
          documentId: op.documentId,
          userId: op.userId,
          type: op.type,
          position: op.position,
          value: op.value,
          sequence: op.sequence,
          createdAt: new Date(op.createdAt),
        };
        await saveOperationLocally(remoteOp);
        newRemoteOps.push(remoteOp);
      }
    }

    // Persist latest sequence checkpoint
    await setLastSyncedSequence(documentId, maxSequence.toString());

    // If new remote operations were merged, notify listening components
    if (newRemoteOps.length > 0) {
      this.notify(documentId, newRemoteOps);
    }
  }
}

// Client-side singleton instantiation
export const syncEngine = typeof window !== "undefined" ? new SyncEngine() : (null as unknown as SyncEngine);
