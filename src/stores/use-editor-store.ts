import { create } from "zustand";

interface EditorState {
  isFocused: boolean;
  selection: { from: number; to: number };
  activeMarks: { bold: boolean; italic: boolean; strike: boolean };
  setFocused: (focused: boolean) => void;
  setSelection: (from: number, to: number) => void;
  setActiveMarks: (marks: { bold: boolean; italic: boolean; strike: boolean }) => void;
}

/**
 * Zustand store to manage editor focus, selections, and formatting state.
 */
export const useEditorStore = create<EditorState>((set) => ({
  isFocused: false,
  selection: { from: 0, to: 0 },
  activeMarks: { bold: false, italic: false, strike: false },
  setFocused: (focused) => set({ isFocused: focused }),
  setSelection: (from, to) => set({ selection: { from, to } }),
  setActiveMarks: (activeMarks) => set({ activeMarks }),
}));
