"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AuthCallback() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // 1. Read Supabase session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        // 2. Verify session exists
        if (!session || !session.user) {
          throw new Error("No active Supabase session found.");
        }

        // 3. Sync user with FastAPI backend
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/sync-oauth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Google User",
            avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to sync user session with backend.");
        }

        const data = await res.json();
        console.log("OAuth synced successfully. Token received:", data.access_token);

        // 4. Save user in Zustand & 5. Save backend token
        useAuthStore.setState({
          user: data.user,
          accessToken: data.access_token,
          token: data.access_token,
          isAuthenticated: true
        });

        login(data.user, data.access_token);

        // 6. router.replace("/dashboard")
        router.replace("/dashboard");
      } catch (err: any) {
        console.error("Callback error:", err);
        setError(err.message || "An unexpected error occurred during Google authentication.");
      }
    };

    handleAuthCallback();
  }, [login, router]);

  if (error) {
    return (
      <main className="flex-grow flex items-center justify-center py-16 px-4 relative min-h-screen bg-[#030712]">
        <div className="w-full max-w-lg p-8 rounded-2xl glass-panel relative overflow-hidden text-center">
          <div aria-hidden="true" className="absolute top-0 inset-x-0 h-1 bg-rose-500" />
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-gray-50 mb-2">Authentication Failed</h2>
          <p className="text-sm text-gray-400 font-body mb-6">{error}</p>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-[#030712] transition-all duration-300"
          >
            Back to Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow flex items-center justify-center py-16 px-4 relative min-h-screen bg-[#030712]">
      {/* Decorative gradient orb */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] -z-10"
      />
      <div className="text-center relative z-10 flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent animate-spin duration-1000" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border border-white/[0.04]" />
        </div>
        <span className="text-sm font-semibold tracking-widest text-cyan-400 uppercase animate-pulse">
          Completing Secure Sign In...
        </span>
      </div>
    </main>
  );
}
