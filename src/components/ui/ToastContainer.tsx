"use client";

import React from "react";
import { useNotificationStore, ToastMessage } from "@/stores/use-notification-store";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";

const ICON_MAP = {
  success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
  error: <AlertCircle className="w-5 h-5 text-rose-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  info: <Info className="w-5 h-5 text-indigo-400" />,
};

const BG_MAP = {
  success: "bg-slate-900 border-emerald-500/20 text-emerald-100 shadow-emerald-500/5",
  error: "bg-slate-900 border-rose-500/20 text-rose-100 shadow-rose-500/5",
  warning: "bg-slate-900 border-amber-500/20 text-amber-100 shadow-amber-500/5",
  info: "bg-slate-900 border-indigo-500/20 text-indigo-100 shadow-indigo-500/5",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 scale-100 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
            BG_MAP[toast.type]
          }`}
          role="alert"
        >
          <div className="flex-shrink-0 mt-0.5">{ICON_MAP[toast.type]}</div>
          <div className="flex-1 text-sm font-medium leading-5">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors duration-150 rounded-lg p-0.5 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
