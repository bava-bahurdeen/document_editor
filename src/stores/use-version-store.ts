import { create } from "zustand";
import { Snapshot } from "@/types";

interface VersionState {
  snapshots: Snapshot[];
  previewSnapshot: Snapshot | null;
  diffOriginal: string | null;
  diffModified: string | null;
  setSnapshots: (snapshots: Snapshot[]) => void;
  setPreviewSnapshot: (snapshot: Snapshot | null) => void;
  setDiffContents: (original: string | null, modified: string | null) => void;
}

/**
 * Zustand store to manage snapshots lists, diff selections, and restore preview scopes.
 */
export const useVersionStore = create<VersionState>((set) => ({
  snapshots: [],
  previewSnapshot: null,
  diffOriginal: null,
  diffModified: null,
  setSnapshots: (snapshots) => set({ snapshots }),
  setPreviewSnapshot: (previewSnapshot) => set({ previewSnapshot }),
  setDiffContents: (diffOriginal, diffModified) => set({ diffOriginal, diffModified }),
}));
