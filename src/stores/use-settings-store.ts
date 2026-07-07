import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  theme: "light" | "dark";
  autoSaveInterval: number; // in ms
  toggleTheme: () => void;
  setAutoSaveInterval: (interval: number) => void;
}

/**
 * Zustand store to manage user settings, persisting parameters directly to localStorage.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      autoSaveInterval: 5000,
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setAutoSaveInterval: (autoSaveInterval) => set({ autoSaveInterval }),
    }),
    {
      name: "document-editor-settings-v1", // unique localStorage key name
    }
  )
);
