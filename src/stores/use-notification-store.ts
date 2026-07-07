import { create } from "zustand";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface NotificationState {
  toasts: ToastMessage[];
  addToast: (type: ToastMessage["type"], message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

/**
 * Zustand store to manage real-time toast alert notifications.
 */
export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  addToast: (type, message, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration }] }));
    
    // Automatically trigger dismissal
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
