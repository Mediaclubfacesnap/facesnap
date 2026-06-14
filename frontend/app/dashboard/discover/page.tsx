"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Users, Search, Star, Loader2,
  Globe, ArrowUpRight, X, AlertCircle, Check, Trash2,
  QrCode, Key, Camera, Link2, ShieldAlert
} from "lucide-react";

interface Community {
  id: string;
  title: string;
  description: string;
  category: string;
  banner_url?: string | null;
  creator_id: string;
}

const getOptimizedImageUrl = (url: string, width: number = 300) => {
  if (!url) return "";
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${width}&resize=contain`;
  }
  return url;
};

export default function DiscoverPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [myRoles, setMyRoles] = useState<Record<string, string>>({});
  const [starred, setStarred] = useState<string[]>([]);
  const [joinRequests, setJoinRequests] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Invite Code State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [isJoiningCode, setIsJoiningCode] = useState(false);
  const [inviteCodeError, setInviteCodeError] = useState("");
  const [inviteCodeSuccess, setInviteCodeSuccess] = useState("");
  const [isScanMode, setIsScanMode] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);


  // Deletion state
  const [deleteCommunityId, setDeleteCommunityId] = useState<string | null>(null);
  const [deleteCommunityTitle, setDeleteCommunityTitle] = useState("");
  const [isDeletingCommunity, setIsDeletingCommunity] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Technology");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const modalTitleRef = useRef<HTMLInputElement>(null);

  // Request Access form
  const [accessFullName, setAccessFullName] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessCollege, setAccessCollege] = useState("");
  const [accessPurpose, setAccessPurpose] = useState("");
  const [accessMembers, setAccessMembers] = useState("");
  const [accessSocials, setAccessSocials] = useState("");
  const [accessReason, setAccessReason] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessSuccess, setAccessSuccess] = useState(false);

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
      const [commRes, rolesRes, starsRes, joinReqsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-roles`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-stars`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-join-requests`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (rolesRes.status === 401 || starsRes.status === 401 || joinReqsRes.status === 401) {
        logout();
        router.push("/auth/login");
        return;
      }

      if (commRes.ok) setCommunities(await commRes.json());
      if (rolesRes.ok) setMyRoles(await rolesRes.json());
      if (starsRes.ok) setStarred(await starsRes.json());
      if (joinReqsRes.ok) setJoinRequests(await joinReqsRes.json());
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

  const handleJoinCommunity = async (e: React.MouseEvent, communityId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/join-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: "I want to join this community as a participant" })
      });
      if (res.ok) {
        setJoinRequests((prev) => ({ ...prev, [communityId]: "pending" }));
      } else {
        const data = await res.json();
        alert(data.detail || "Unable to join community.");
      }
    } catch (err) {
      console.error("Join request failed:", err);
    }
  };

  const handleJoinByCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    
    setIsJoiningCode(true);
    setInviteCodeError("");
    setInviteCodeSuccess("");
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/join-by-code/${inviteCodeInput.trim()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid invite code or permission denied.");
      }
      
      if (data.joined) {
        setInviteCodeSuccess(data.message || "Successfully joined community!");
        setTimeout(() => {
          setShowInviteModal(false);
          setInviteCodeInput("");
          setInviteCodeSuccess("");
          fetchData(); // reload communities
          if (data.community_id) {
            router.push(`/dashboard/my-groups/${data.community_id}`);
          }
        }, 1500);
      } else {
        setInviteCodeSuccess(data.message || "Join request submitted successfully.");
        setTimeout(() => {
          setShowInviteModal(false);
          setInviteCodeInput("");
          setInviteCodeSuccess("");
          fetchData();
        }, 3000);
      }
    } catch (err: any) {
      setInviteCodeError(err.message || "Failed to join via invite code.");
    } finally {
      setIsJoiningCode(false);
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setIsSubmitting(true);

    try {
      if (!token) throw new Error("No authentication token found.");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          description: newDescription.trim()
        })
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

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError("");
    setAccessSuccess(false);
    setIsSubmitting(true);

    try {
      console.log("Token:", token);
      if (!token) throw new Error("No authentication token found.");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/access-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: accessFullName,
          email: accessEmail,
          college: accessCollege,
          purpose: accessPurpose,
          expected_members: accessMembers,
          social_links: accessSocials,
          reason: accessReason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit request.");

      setAccessSuccess(true);
      setTimeout(() => {
        setShowAccessModal(false);
      }, 3000);
    } catch (err: any) {
      setAccessError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteCommunity = (id: string, title: string) => {
    setDeleteCommunityId(id);
    setDeleteCommunityTitle(title);
  };

  const handleDeleteCommunity = async () => {
    if (!deleteCommunityId || !token) return;
    setIsDeletingCommunity(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${deleteCommunityId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCommunities((prev) => prev.filter((c) => c.id !== deleteCommunityId));
        setDeleteCommunityId(null);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete community.");
      }
    } catch (err) {
      console.error("Delete community error:", err);
    } finally {
      setIsDeletingCommunity(false);
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
          <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-gray-400">
                Private Communities
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-50">
              My Communities
            </h1>
            <p className="mt-3 text-base text-gray-400 max-w-lg mx-auto">
              Access your private communities, events, and photo galleries.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsScanMode(false);
                  setShowInviteModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-sm font-semibold transition-all duration-300 shadow-lg shadow-primary/5"
              >
                <Key className="w-4 h-4" />
                <span>Enter Invite Code</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setIsScanMode(true);
                  setShowInviteModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] text-gray-300 text-sm font-semibold transition-all duration-300"
              >
                <QrCode className="w-4 h-4 text-gray-400" />
                <span>Scan QR Code</span>
              </button>
            </div>

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
          ) : communities.length === 0 ? (
            <div className="flex flex-col items-center justify-center max-w-xl mx-auto py-16 px-6 text-center rounded-2xl glass-panel border border-white/[0.06] bg-[#050b18]/60 backdrop-blur-md">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">No Communities Joined</h2>
              <p className="text-sm text-gray-400 max-w-md mb-8">
                You're not part of any communities yet. Join using an invite link or code to access private event photos, galleries, and group chats.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsScanMode(false);
                    setShowInviteModal(true);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-[#030712] font-semibold text-sm hover:bg-cyan-400 transition-colors shadow-lg shadow-primary/10"
                >
                  <Key className="w-4 h-4" />
                  <span>Join Community</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsScanMode(true);
                    setShowInviteModal(true);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-300 font-semibold text-sm transition-colors"
                >
                  <QrCode className="w-4 h-4 text-gray-400" />
                  <span>Scan QR Code</span>
                </button>
              </div>
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
                    onClick={() => router.push(role ? `/dashboard/my-groups/${comm.id}` : `/dashboard/communities/${comm.id}`)}
                  >
                    {/* Banner */}
                    <div className="h-28 relative overflow-hidden">
                      {comm?.banner_url ? (
                        <img
                          src={getOptimizedImageUrl(comm.banner_url, 400)}
                          alt=""
                          className="w-full h-full object-cover opacity-40"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/[0.08] to-tertiary/[0.06]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

                      {/* Delete Button */}
                      {(user?.platform_role === "super_admin" || user?.platform_role === "admin" || user?.id === comm.creator_id) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteCommunity(comm.id, comm.title);
                          }}
                          className="absolute top-3 left-3 p-1.5 rounded-lg bg-black/40 backdrop-blur border border-white/[0.08] hover:border-red-500/30 transition-all z-10"
                          aria-label={`Delete ${comm.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500 hover:text-red-400" />
                        </button>
                      )}

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
                        {role ? (
                          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                            Joined
                          </span>
                        ) : joinRequests[comm.id] === "pending" ? (
                          <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg">
                            Request Sent
                          </span>
                        ) : (
                          <button
                            onClick={(e) => handleJoinCommunity(e, comm.id)}
                            type="button"
                            className="text-xs font-semibold bg-primary text-black hover:bg-cyan-400 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Join Community
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Create New Community Card */}
              {user?.platform_role === "super_admin" || user?.can_create_communities ? (
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
              ) : (
                <motion.div
                  whileHover={{ y: -3 }}
                  onClick={() => setShowAccessModal(true)}
                  className="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-amber-500/25 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[280px]"
                >
                  <div className="w-12 h-12 rounded-lg bg-amber-500/[0.04] border border-amber-500/[0.08] flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-400">Request Access</span>
                </motion.div>
              )}
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

      {/* ====== REQUEST ACCESS MODAL ====== */}
      <AnimatePresence>
        {showAccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAccessModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="request-access-title"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-lg rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setShowAccessModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
                <h2 id="request-access-title" className="text-lg font-display font-semibold text-gray-50">Request Access</h2>
              </div>
              <p className="text-sm text-gray-400 mb-6 mt-2">Submit a request to become a Community Host.</p>

              {accessError && (
                <div className="mb-4 p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-secondary font-medium flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {accessError}
                </div>
              )}

              {accessSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-2">Request Submitted</h3>
                  <p className="text-gray-400">An admin will review your request shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleRequestAccess} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="accessFullName" className="text-sm font-medium text-gray-200">Full Name</label>
                    <input
                      id="accessFullName"
                      type="text"
                      required
                      value={accessFullName}
                      onChange={(e) => setAccessFullName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="accessEmail" className="text-sm font-medium text-gray-200">Email Address</label>
                    <input
                      id="accessEmail"
                      type="email"
                      required
                      value={accessEmail}
                      onChange={(e) => setAccessEmail(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="accessCollege" className="text-sm font-medium text-gray-200">College / Organization</label>
                    <input
                      id="accessCollege"
                      type="text"
                      required
                      value={accessCollege}
                      onChange={(e) => setAccessCollege(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      placeholder="University Name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="accessPurpose" className="text-sm font-medium text-gray-200">Purpose of Community</label>
                    <input
                      id="accessPurpose"
                      type="text"
                      required
                      value={accessPurpose}
                      onChange={(e) => setAccessPurpose(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      placeholder="e.g. Photography Club"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="accessReason" className="text-sm font-medium text-gray-200">Why do you need host access?</label>
                    <textarea
                      id="accessReason"
                      required
                      rows={3}
                      value={accessReason}
                      onChange={(e) => setAccessReason(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                      placeholder="Explain your use case..."
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAccessModal(false)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE COMMUNITY CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteCommunityId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteCommunityId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-red-500 rounded-t-2xl" aria-hidden="true" />
              <h2 className="text-lg font-display font-semibold text-gray-50 mb-1">Delete Community</h2>
              <p className="text-sm text-gray-400 mb-6">
                Are you sure you want to delete this community? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteCommunityId(null)}
                  className="px-4 py-2 rounded-lg bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCommunity}
                  disabled={isDeletingCommunity}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all flex items-center gap-2"
                >
                  {isDeletingCommunity ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====== JOIN BY CODE / QR MODAL ====== */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="join-code-title"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-cyan-400 rounded-t-2xl" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  {isScanMode ? (
                    <QrCode className="w-5 h-5 text-primary" />
                  ) : (
                    <Key className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <h2 id="join-code-title" className="text-lg font-display font-semibold text-gray-50">
                    {isScanMode ? "Scan QR Invitation" : "Join Private Community"}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {isScanMode ? "Point your camera at the community QR code" : "Enter invite code to join community"}
                  </p>
                </div>
              </div>

              {inviteCodeError && (
                <div className="my-4 p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-secondary font-medium flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {inviteCodeError}
                </div>
              )}

              {inviteCodeSuccess && (
                <div className="my-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 font-medium flex items-center gap-2" role="alert">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {inviteCodeSuccess}
                </div>
              )}

              {isScanMode ? (
                <div className="space-y-6 mt-6">
                  {/* Camera view simulation */}
                  <div className="relative aspect-video rounded-xl bg-black border border-white/[0.08] overflow-hidden flex flex-col items-center justify-center group">
                    <Camera className="w-8 h-8 text-gray-600 animate-pulse" />
                    <span className="text-xs text-gray-500 mt-2">Active Camera Stream...</span>
                    
                    {/* Corner Reticles */}
                    <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary" />
                    <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary" />
                    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary" />
                    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary" />
                    
                    {/* Scanner line */}
                    <div className="absolute inset-x-4 h-0.5 bg-primary/40 shadow-[0_0_10px_#06b6d4] top-1/2 animate-bounce" />

                    <div className="absolute bottom-4 inset-x-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setInviteCodeInput("WELCOME2026");
                          setIsScanMode(false);
                          // simulate a tiny delay then trigger the submit
                          setTimeout(() => {
                            const input = document.getElementById("invite-code-field") as HTMLInputElement;
                            if (input) input.focus();
                          }, 100);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary text-black font-semibold text-xs hover:bg-cyan-400 transition-colors shadow-lg shadow-primary/20"
                      >
                        Simulate QR Scan
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsScanMode(false)}
                    className="w-full py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-xs font-semibold text-gray-400 hover:text-white transition-all text-center"
                  >
                    Switch to manual code entry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoinByCode} className="space-y-4 mt-6">
                  <div>
                    <label htmlFor="invite-code-field" className="block text-sm font-medium text-gray-300 mb-1.5">
                      Invite Code
                    </label>
                    <input
                      id="invite-code-field"
                      type="text"
                      required
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      placeholder="e.g. WELCOME2026"
                      className="w-full h-12 px-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors uppercase tracking-wider text-center font-mono font-bold"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsScanMode(true)}
                      className="px-4 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-400 hover:text-white transition-all flex items-center justify-center"
                      title="Scan QR Code"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                    <button
                      type="submit"
                      disabled={isJoiningCode || !inviteCodeInput.trim()}
                      className="flex-grow flex items-center justify-center gap-2 py-3 rounded-lg bg-primary hover:bg-cyan-400 text-[#030712] text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isJoiningCode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ArrowUpRight className="w-4 h-4" />
                          <span>Join Workspace</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
