"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Loader2, AlertCircle, Check, 
  ArrowRight, ShieldAlert, Sparkles, Image as ImageIcon,
  Compass, QrCode
} from "lucide-react";

const getOptimizedImageUrl = (url: string, width: number = 600) => {
  if (!url) return "";
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${width}&resize=contain`;
  }
  return url;
};

function JoinPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";
  const src = searchParams.get("src") || "";

  const { token, isAuthenticated } = useAuthStore();

  const [lookupData, setLookupData] = useState<any>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");

  useEffect(() => {
    if (!code) {
      setError("No invite code provided. Please scan a valid QR code or enter an invite code.");
      setIsLoading(false);
      return;
    }
    lookupCode();
  }, [code]);

  const lookupCode = async () => {
    try {
      setIsLoading(true);
      setError("");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/invite-codes/lookup/${code.trim()}`
      );
      const data = await res.json();
      if (!res.ok || data.valid === false) {
        setError(data.error || "Failed to lookup invite code.");
      } else {
        setLookupData(data);
      }
    } catch (err) {
      console.error("Invite lookup error:", err);
      setError("Network error. Failed to resolve invite code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!isAuthenticated) {
      // Store redirect target in session storage to redirect back after login
      sessionStorage.setItem("authRedirectTo", `/dashboard/join?code=${code}&src=${src}`);
      router.push("/auth/login");
      return;
    }

    try {
      setIsJoining(true);
      setJoinError("");
      setJoinSuccess("");

      const joinUrl = new URL(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/join-by-code/${code.trim()}`
      );
      if (src) {
        joinUrl.searchParams.append("src", src);
      }

      const res = await fetch(joinUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to redeem invite code.");
      }

      if (data.joined) {
        setJoinSuccess(data.message || "Successfully joined community!");
        setTimeout(() => {
          router.push(`/dashboard/my-groups/${data.community_id}`);
        }, 1500);
      } else {
        setJoinSuccess(data.message || "Request submitted successfully. Waiting for host approval.");
      }
    } catch (err: any) {
      console.error("Join redemption error:", err);
      setJoinError(err.message || "Failed to join community.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16 md:py-24 relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl" />

        <div className="w-full max-w-md relative z-10">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-2xl shadow-indigo-950/20"
              >
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-slate-400 text-sm font-medium">Resolving your invite invitation...</p>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl space-y-6 shadow-2xl"
              >
                <div className="flex justify-center">
                  <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold text-slate-100">Unable to Join</h2>
                  <p className="text-slate-400 text-sm leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={() => router.push("/dashboard/discover")}
                  className="w-full bg-slate-800 hover:bg-slate-750 active:bg-slate-850 text-slate-200 py-3.5 rounded-2xl font-semibold transition-all duration-200 border border-slate-700/50 flex items-center justify-center space-x-2 text-sm"
                >
                  <Compass className="w-4 h-4" />
                  <span>Explore Communities</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-950/30 flex flex-col"
              >
                {/* Banner image or default cover */}
                <div className="h-44 w-full relative bg-slate-800 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
                  {lookupData.banner_url ? (
                    <img
                      src={getOptimizedImageUrl(lookupData.banner_url)}
                      alt={lookupData.community_title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-indigo-500/40" />
                    </div>
                  )}
                  {/* Category tag */}
                  <span className="absolute top-4 right-4 bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-md">
                    {lookupData.category}
                  </span>

                  {src === "qr" && (
                    <span className="absolute top-4 left-4 bg-fuchsia-500/25 border border-fuchsia-500/35 text-fuchsia-300 text-xs font-semibold px-2.5 py-1.5 rounded-full backdrop-blur-md flex items-center space-x-1">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR Join</span>
                    </span>
                  )}
                </div>

                {/* Details Content */}
                <div className="p-8 space-y-6">
                  <div className="space-y-3">
                    <h1 className="text-2xl font-bold text-slate-100 tracking-tight leading-snug">
                      {lookupData.community_title}
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed min-h-[40px]">
                      {lookupData.community_description}
                    </p>
                  </div>

                  {/* Metadata Stats */}
                  <div className="flex items-center space-x-6 py-2 border-y border-slate-800/60 text-slate-300">
                    <div className="flex items-center space-x-2.5">
                      <Users className="w-5 h-5 text-indigo-400" />
                      <div className="text-xs">
                        <span className="block text-slate-400">Participants</span>
                        <span className="font-bold text-sm text-slate-200">{lookupData.participant_count}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      <div className="text-xs">
                        <span className="block text-slate-400">Join Mode</span>
                        <span className="font-bold text-sm text-slate-200 capitalize">{lookupData.join_mode} join</span>
                      </div>
                    </div>
                  </div>

                  {/* Alerts and errors */}
                  <AnimatePresence>
                    {joinError && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="bg-rose-500/10 text-rose-400 border border-rose-500/20 p-4 rounded-2xl flex items-start space-x-2.5 text-sm"
                      >
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{joinError}</span>
                      </motion.div>
                    )}

                    {joinSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-4 rounded-2xl flex items-start space-x-2.5 text-sm"
                      >
                        <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{joinSuccess}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Join action button */}
                  {!joinSuccess && (
                    <button
                      onClick={handleJoin}
                      disabled={isJoining}
                      className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 active:from-indigo-600 active:to-indigo-700 text-white py-4 rounded-2xl font-bold transition-all duration-200 flex items-center justify-center space-x-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-550/10 hover:shadow-indigo-550/20"
                    >
                      {isJoining ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Redeeming Invite...</span>
                        </>
                      ) : (
                        <>
                          <span>{isAuthenticated ? (lookupData.join_mode === "auto" ? "Join Space" : "Request to Join") : "Sign In to Join"}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function JoinPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    }>
      <JoinPreviewContent />
    </Suspense>
  );
}
