import { create } from "zustand";

interface SyncState {
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  setOnline: (online: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setSyncing: (syncing: boolean) => void;
}

/**
 * Zustand store to manage real-time online status and sync state statistics.
 */
export const useSyncStore = create<SyncState>((set) => ({
  isOnline: typeof window !== "undefined" ? window.navigator.onLine : true,
  pendingSyncCount: 0,
  isSyncing: false,
  setOnline: (online) => set({ isOnline: online }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
}));
