import { create } from "zustand";

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: "success" | "info" | "warning" | "alert";
  duration?: number;
}

interface NotificationState {
  toasts: ToastMessage[];
  addToast: (title: string, description: string, type?: "success" | "info" | "warning" | "alert") => void;
  removeToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  addToast: (title, description, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, title, description, type };
    
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto-remove after 4.5 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  }
}));
