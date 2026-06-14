"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ToastContainer from "@/components/ToastContainer";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { useNetworkSync } from "@/hooks/useNetworkSync";
import MobileBottomNav from "@/components/MobileBottomNav";
import InstallBanner from "@/components/InstallBanner";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useNotificationStore();
  const { isAuthenticated, user, isInitialized, initializeAuth, logout } = useAuthStore();

  // Initialize offline sync queue listener
  useNetworkSync();

  // Initialize auth state from local session/Supabase
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Route protection and session expiry rules
  useEffect(() => {
    if (!isInitialized) return;

    /*
     * SESSION EXPIRY MECHANISM:
     * - Why the timestamp is stored: The 'facesnap_login_time' timestamp is stored in localStorage
     *   on successful login or registration to track when the user session began and enforce
     *   automatic session expiry.
     * - How the 5-day expiry works: On startup and route transitions, we compare 'Date.now()' with
     *   the stored login time. If the duration exceeds SESSION_DURATION (5 days / 432,000,000 ms),
     *   we trigger an automatic session invalidation sequence.
     * - Why Supabase signOut is required: We explicitly call 'supabase.auth.signOut()' to terminate
     *   the server-side session in Supabase, ensuring that the local session and Supabase session
     *   never become out of sync.
     */
    const SESSION_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
    const loginTime = typeof window !== "undefined" ? localStorage.getItem("facesnap_login_time") : null;
    
    if (isAuthenticated && loginTime && (Date.now() - Number(loginTime) > SESSION_DURATION)) {
      console.log("Global check: Auth session has expired (5 days exceeded). Synchronizing signout.");
      
      const handleExpire = async () => {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error("Error signing out from Supabase on session expiry:", err);
        }
        await logout();
        router.replace("/auth/login");
      };

      handleExpire();
      return;
    }

    // 2. Standard Redirect Rules
    if (isAuthenticated && pathname.startsWith("/auth")) {
      router.replace("/dashboard");
    } else if (!isAuthenticated && pathname.startsWith("/dashboard")) {
      router.replace("/auth/login");
    }
  }, [isInitialized, isAuthenticated, pathname, router, logout]); // Force rebuild

  // Welcome toast on authentication success
  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = setTimeout(() => {
      addToast(
        "Welcome back",
        `Secure session established for @${user?.username || "user"}.`,
        "success"
      );
    }, 1200);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, addToast]);

  const showLoader = !isInitialized || 
    (isAuthenticated && pathname.startsWith("/auth")) || 
    (!isAuthenticated && pathname.startsWith("/dashboard"));

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
      
      {showLoader ? (
        <div className="min-h-screen flex items-center justify-center bg-[#030712] relative overflow-hidden">
          <div className="text-center relative z-10 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent animate-spin duration-1000" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border border-white/[0.04]" />
            </div>
            <span className="text-sm font-semibold tracking-widest text-cyan-400 uppercase animate-pulse">
              Authenticating Secure Session...
            </span>
          </div>
        </div>
      ) : (
        /* Content Area */
        <ErrorBoundary>
          <main id="main-content" className="relative min-h-screen flex flex-col z-10 md:pb-0 pb-[70px]">
            {children}
          </main>
        </ErrorBoundary>
      )}

      <MobileBottomNav />
      <InstallBanner />

      {/* Global Notification Toasts */}
      <ToastContainer />
    </QueryClientProvider>
  );
}
