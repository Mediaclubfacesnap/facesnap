 "use client";

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ToastContainer from "@/components/ToastContainer";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const { addToast } = useNotificationStore();
  const { isAuthenticated, user } = useAuthStore();

  // Welcome toast on auth
  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = setTimeout(() => {
      addToast(
        "Welcome back",
        `Secure session established for @${user?.username}.`,
        "success"
      );
    }, 1200);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Skip to content link for keyboard navigation */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* Subtle Background Mesh Gradients */}
      <div className="mesh-gradient-container" aria-hidden="true">
        <div className="mesh-glow-1" />
        <div className="mesh-glow-2" />
      </div>
      
      {/* Content Area */}
      <main id="main-content" className="relative min-h-screen flex flex-col z-10">
        {children}
      </main>

      {/* Global Notification Toasts */}
      <ToastContainer />
    </QueryClientProvider>
  );
}
