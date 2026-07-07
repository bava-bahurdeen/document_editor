import { create } from "zustand";

interface DocumentState {
  activeDocumentId: string | null;
  recentDocuments: string[];
  setActiveDocumentId: (id: string | null) => void;
  addRecentDocument: (id: string) => void;
}

/**
 * Zustand store to manage active document selection and recently visited history.
 */
export const useDocumentStore = create<DocumentState>((set) => ({
  activeDocumentId: null,
  recentDocuments: [],
  setActiveDocumentId: (id) => set({ activeDocumentId: id }),
  addRecentDocument: (id) =>
    set((state) => {
      const filtered = state.recentDocuments.filter((x) => x !== id);
      return { recentDocuments: [id, ...filtered].slice(0, 10) };
    }),
}));
