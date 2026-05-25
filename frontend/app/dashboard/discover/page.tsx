"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Users, Search, Star, Sparkles, Loader2,
  Globe, ArrowUpRight, X, AlertCircle
} from "lucide-react";

interface Community {
  id: string;
  title: string;
  description: string;
  category: string;
  banner_url?: string | null;
  creator_id: string;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { token, isAuthenticated, logout } = useAuthStore();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [myRoles, setMyRoles] = useState<Record<string, string>>({});
  const [starred, setStarred] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Technology");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const modalTitleRef = useRef<HTMLInputElement>(null);

  const categories = ["Technology", "Education", "Photography", "Music", "Sports", "Hackathon"];

  // Modal keyboard & focus
  const handleModalEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setShowCreateModal(false);
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      document.addEventListener("keydown", handleModalEsc);
      document.body.style.overflow = "hidden";
      setTimeout(() => modalTitleRef.current?.focus(), 50);
      return () => {
        document.removeEventListener("keydown", handleModalEsc);
        document.body.style.overflow = "";
      };
    }
  }, [showCreateModal, handleModalEsc]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [commRes, rolesRes, starsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-roles`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-stars`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (rolesRes.status === 401 || starsRes.status === 401) {
        logout();
        router.push("/auth/login");
        return;
      }

      if (commRes.ok) setCommunities(await commRes.json());
      if (rolesRes.ok) setMyRoles(await rolesRes.json());
      if (starsRes.ok) setStarred(await starsRes.json());
    } catch (err) {
      console.error("Discover fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStar = async (communityId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/star`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStarred((prev) =>
          data.starred ? [...prev, communityId] : prev.filter((id) => id !== communityId)
        );
      }
    } catch (err) {
      console.error("Discover star toggle error:", err);
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCreateError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          category: newCategory,
        }),
      });

      const data = await res.json();

      if (res.status === 401) {
        logout();
        router.push("/auth/login");
        return;
      }

      if (!res.ok) throw new Error(data.detail || "Failed to create community.");

      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      router.push(`/dashboard/my-groups/${data.id}`);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };


  const filteredCommunities =
    communities
      ?.filter(
        (c) =>
          c?.title?.toLowerCase().includes(searchQuery?.toLowerCase() || "") ||
          c?.category?.toLowerCase().includes(searchQuery?.toLowerCase() || "") ||
          c?.description?.toLowerCase().includes(searchQuery?.toLowerCase() || "")
      )
      ?.sort((a, b) => {
        const aStarred = starred?.includes(a.id) ? -1 : 0;
        const bStarred = starred?.includes(b.id) ? -1 : 0;
        return aStarred - bStarred;
      }) || [];

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-gray-50">
      <Navbar />

      <div className="flex-grow">
        {/* Hero Banner */}
        <div className="relative px-4 py-16 md:py-20 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent" aria-hidden="true" />
          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-gray-400">
                Public Discovery
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-50">
              Discover Communities
            </h1>
            <p className="mt-3 text-base text-gray-400 max-w-lg mx-auto">
              Browse public AI-powered event ecosystems, join communities, and find your memories.
            </p>

            <div className="mt-8 max-w-md mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search communities..."
                aria-label="Search communities by name or category"
                className="w-full h-12 pl-11 pr-10 rounded-xl bg-[#0a0f1a] border border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Communities Grid */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {isLoading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm text-gray-400">
                Loading communities...
              </span>
            </div>
          ) : filteredCommunities.length === 0 && searchQuery ? (
            <div className="flex flex-col items-center py-20 gap-4 text-center">
              <Search className="w-12 h-12 text-gray-700" />
              <h3 className="text-lg font-medium text-gray-300">No communities found</h3>
              <p className="text-sm text-gray-500">Try a different search term or create a new community.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCommunities.map((comm, i) => {
                if (!comm) return null;
                const isStarred = starred?.includes(comm.id);
                const role = myRoles?.[comm.id];
                return (
                  <motion.div
                    key={comm.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    whileHover={{ y: -3 }}
                    className="rounded-xl glass-panel border border-white/[0.06] card-hover overflow-hidden cursor-pointer transition-all duration-300 group relative"
                    onClick={() => router.push(`/dashboard/communities/${comm.id}`)}
                  >
                    {/* Banner */}
                    <div className="h-28 relative overflow-hidden">
                      {comm?.banner_url ? (
                        <img
                          src={comm.banner_url}
                          alt=""
                          className="w-full h-full object-cover opacity-40"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/[0.08] to-tertiary/[0.06]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

                      {/* Star Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(comm.id);
                        }}
                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 backdrop-blur border border-white/[0.08] hover:border-amber-400/30 transition-all z-10"
                        aria-label={isStarred ? `Remove ${comm.title} from favorites` : `Add ${comm.title} to favorites`}
                      >
                        <Star
                          className={`w-3.5 h-3.5 transition-colors ${
                            isStarred ? "text-amber-400 fill-amber-400" : "text-gray-500"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/[0.08] border border-primary/20 text-primary">
                          {comm.category}
                        </span>
                        {role && (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            {role}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-semibold text-gray-50 group-hover:text-primary transition-colors">
                        {comm.title}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {comm.description}
                      </p>

                      <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span>Community</span>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Create New Community Card */}
              <motion.div
                whileHover={{ y: -3 }}
                onClick={() => setShowCreateModal(true)}
                className="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-primary/25 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[280px]"
              >
                <div className="w-12 h-12 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-gray-400">Create Community</span>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE COMMUNITY MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="discover-create-title"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-lg rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-tertiary rounded-t-2xl" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 id="discover-create-title" className="text-lg font-display font-semibold text-gray-50 mb-1">Create Community</h2>
              <p className="text-sm text-gray-400 mb-6">Set up a new workspace for your group.</p>

              {createError && (
                <div className="mb-4 p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-secondary font-medium flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateCommunity} className="space-y-4">
                <div>
                  <label htmlFor="discover-title" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Workspace Title
                  </label>
                  <input
                    id="discover-title"
                    ref={modalTitleRef}
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. CS Department"
                    className="w-full h-12 px-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="discover-category" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Category
                  </label>
                  <select
                    id="discover-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-base text-gray-50 transition-colors cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#0a0f1a]">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="discover-description" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="discover-description"
                    required
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe your community workspace..."
                    className="w-full px-4 py-3 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-grow py-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-sm text-gray-300 font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-grow flex items-center justify-center gap-2 py-3 rounded-lg bg-primary hover:bg-cyan-400 text-[#030712] text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Create Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
