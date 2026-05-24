"use client";

import React from "react";
import { useNotificationStore, ToastMessage } from "@/store/notificationStore";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, Activity, Bell, X, Info } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore();

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      case "alert":
        return <Activity className="w-4 h-4 text-rose-400" />;
      case "warning":
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case "success":
        return "border-cyan-500/20";
      case "alert":
        return "border-rose-500/20";
      case "warning":
        return "border-amber-500/20";
      default:
        return "border-white/[0.08]";
    }
  };

  return (
    <div 
      className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={`pointer-events-auto w-full p-4 rounded-xl glass-panel border ${getBorderColor(toast.type)} flex items-start gap-3 relative overflow-hidden`}
          >
            <div className="p-2 rounded-lg bg-white/[0.04] flex-shrink-0">
              {getIcon(toast.type)}
            </div>

            <div className="flex-grow pr-6 min-w-0">
              <h4 className="text-sm font-semibold text-gray-50">{toast.title}</h4>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {toast.description}
              </p>
            </div>

            <button 
              onClick={() => removeToast(toast.id)}
              className="absolute top-3.5 right-3.5 text-gray-500 hover:text-gray-300 transition-colors p-0.5"
              aria-label="Close notification"
              type="button"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Auto-dismiss progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
              <motion.div
                className={`h-full ${
                  toast.type === 'success' ? 'bg-cyan-500/40' :
                  toast.type === 'alert' ? 'bg-rose-500/40' :
                  toast.type === 'warning' ? 'bg-amber-500/40' :
                  'bg-white/10'
                }`}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4.5, ease: "linear" }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
