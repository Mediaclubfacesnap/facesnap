"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Sparkles, Heart, EyeOff, X, Check, Loader2, Download, Share2,
  Trash2, Filter, Calendar, Settings, AlertCircle, ThumbsUp, ThumbsDown,
  Clock, ShieldAlert, CheckCircle2, ChevronRight, Home, Compass, Activity, Bell, Shield, LogOut, MessageSquare, Search
} from "lucide-react";

interface MyPhoto {
  match_id: string;
  media_id: string | null;
  photo_id: string | null;
  file_url: string;
  confidence: number;
  status: string;
  is_favorite: boolean;
  is_hidden: boolean;
  title: string | null;
  description: string | null;
  created_at: string;
  community_title: string;
  album_name: string | null;
}

const getOptimizedImageUrl = (url: string, width: number = 250) => {
  if (!url) return "";
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${width}&resize=contain`;
  }
  return url;
};

export default function MyPhotosPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout, refreshUser } = useAuthStore();

  const [photos, setPhotos] = useState<MyPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<MyPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "favorites" | "recent" | "activity">("all");
  const [selectedCommunity, setSelectedCommunity] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<number>(75);
  const [searchQuery, setSearchQuery] = useState("");

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeGalleryList, setActiveGalleryList] = useState<MyPhoto[]>([]);

  // Activity Feed
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Sharing
  const [conversationsForShare, setConversationsForShare] = useState<any[]>([]);
  const [selectedConvForShare, setSelectedConvForShare] = useState<string>("");
  const [isSendingShare, setIsSendingShare] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchPhotosData();
  }, [isAuthenticated, user]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchConversationsForShare = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversationsForShare(data);
        if (data.length > 0) setSelectedConvForShare(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareInChat = async () => {
    if (!selectedConvForShare || lightboxIndex === null) return;
    setIsSendingShare(true);
    const photo = activeGalleryList[lightboxIndex];
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/${selectedConvForShare}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: photo.file_url,
          message_type: "photo_share",
          shared_item_id: photo.photo_id || photo.media_id
        })
      });
      if (res.ok) {
        showToast("Photo shared in private chat!", "success");
        setShowShareModal(false);
      } else {
        showToast("Failed to share photo", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    } finally {
      setIsSendingShare(false);
    }
  };

  const fetchPhotosData = async () => {
    setIsLoading(true);
    setPage(1);
    setHasMore(true);
    try {
      const [approvedRes, pendingRes, activityRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/photos/me?limit=12&offset=0`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/photos/me/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/photos/activity`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (approvedRes.status === 401 || pendingRes.status === 401) {
        logout();
        router.push("/auth/login");
        return;
      }

      if (approvedRes.ok) {
        const approvedData = await approvedRes.json();
        setPhotos(approvedData);
        if (approvedData.length < 12) setHasMore(false);
      }
      if (pendingRes.ok) setPendingPhotos(await pendingRes.json());
      if (pendingRes.ok) setPendingPhotos(await pendingRes.json());
      if (activityRes.ok) setActivityFeed(await activityRes.json());
    } catch (err) {
      console.error("Failed to fetch gallery matches:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePhotos = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    try {
      const nextPage = page + 1;
      const offset = (nextPage - 1) * 12;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/photos/me?limit=12&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setPhotos(prev => [...prev, ...data]);
          setPage(nextPage);
          if (data.length < 12) setHasMore(false);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Failed to load more photos:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    if (isLoading || !hasMore || activeFilter !== "all") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMorePhotos();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }
    return () => observer.disconnect();
  }, [isLoading, hasMore, page, activeFilter, token]);

  const handleFavoriteMatch = async (matchId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/photos/${matchId}/favorite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos((prev) =>
          prev.map((p) => (p.match_id === matchId ? { ...p, is_favorite: data.is_favorite } : p))
        );
        showToast(data.is_favorite ? "✓ Added to favorites!" : "Removed from favorites.", "success");
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleHideMatch = async (matchId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/photos/${matchId}/hide`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.match_id !== matchId));
        setPendingPhotos((prev) => prev.filter((p) => p.match_id !== matchId));
        showToast("Match hidden from gallery.", "success");
      }
    } catch (err) {
      console.error("Failed to hide match:", err);
    }
  };

  const handleConfirmMatch = async (matchId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/photos/${matchId}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const confirmedItem = pendingPhotos.find((p) => p.match_id === matchId);
        if (confirmedItem) {
          const updatedItem = { ...confirmedItem, status: "approved", is_verified_match: true };
          setPhotos((prev) => [updatedItem, ...prev]);
        }
        setPendingPhotos((prev) => prev.filter((p) => p.match_id !== matchId));
        showToast("✓ Face match verified & approved!", "success");
      }
    } catch (err) {
      console.error("Failed to confirm match:", err);
    }
  };

  const handleRejectMatch = async (matchId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/photos/${matchId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.match_id !== matchId));
        setPendingPhotos((prev) => prev.filter((p) => p.match_id !== matchId));
        showToast("Match rejected & removed.", "success");
      }
    } catch (err) {
      console.error("Failed to reject match:", err);
    }
  };



  const handleDownload = async (url: string, title: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `${title.replace(/\s+/g, "_") || "facesnap"}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Download started!", "success");
    } catch (err) {
      console.error("Failed to download image:", err);
      showToast("Failed to download image.", "error");
    }
  };

  const handleShare = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard!", "success");
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Filtering Logic
  const filteredPhotos = photos.filter((p) => {
    if (activeFilter === "favorites" && !p.is_favorite) return false;
    if (activeFilter === "recent") {
      const past24h = new Date().getTime() - 24 * 60 * 60 * 1000;
      if (new Date(p.created_at).getTime() < past24h) return false;
    }
    if (selectedCommunity !== "all" && p.community_title !== selectedCommunity) return false;
    if (p.confidence * 100 < confidenceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inTitle = p.title?.toLowerCase().includes(q);
      const inCommunity = p.community_title.toLowerCase().includes(q);
      const inAlbum = p.album_name?.toLowerCase().includes(q);
      if (!inTitle && !inCommunity && !inAlbum) return false;
    }
    return true;
  });

  const communitiesList = Array.from(new Set(photos.map((p) => p.community_title)));

  // Lightbox opener
  const openLightbox = (index: number, list: MyPhoto[]) => {
    setActiveGalleryList(list);
    setLightboxIndex(index);
  };

  // Mobile navigation drawer toggle
  const handleSignOut = () => { logout(); router.push("/"); };

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">

      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-secondary/20 to-primary/20 border border-white/[0.08]">
              <Camera className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider text-white">FaceSnap</span>
              <span className="block text-[7px] tracking-[0.2em] text-secondary font-bold uppercase -mt-0.5">
                AI Workspace OS
              </span>
            </div>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/discover")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Compass className="w-4 h-4" />
            <span>Discover</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/search")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Search className="w-4 h-4 text-primary" />
            <span>Smart Search</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/timeline")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Activity className="w-4 h-4 text-secondary" />
            <span>Personal Timeline</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/my-photos")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-white/[0.04] border border-white/[0.08] transition-all duration-200"
          >
            <Camera className="w-4 h-4 text-primary" />
            <span>My Photos</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/chat")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>Private Chat</span>
          </button>
        </nav>

        <div className="mt-auto px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-semibold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="text-xs font-semibold text-white block truncate">{user?.full_name}</span>
              <span className="text-[9px] text-gray-500 block truncate font-medium">@{user?.username}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ====== MAIN CONTENT SECTION ====== */}
      <main className="flex-grow overflow-y-auto min-h-screen">
        
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 glass-panel border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <span className="text-sm font-display font-bold text-gray-50">FaceSnap</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/dashboard/settings/notifications")} className="p-2 rounded-lg bg-white/[0.04]">
              <Settings className="w-4 h-4 text-gray-300" />
            </button>
            <button onClick={handleSignOut} className="p-2 rounded-lg bg-white/[0.04]">
              <LogOut className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* Premium Header */}
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-4 hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/[0.08] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                My Discoveries
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                Your AI-Powered Personal Gallery
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/settings/notifications")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-gray-300 font-medium transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </button>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Module 10: Statistics Deck */}
          {!isLoading && photos.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Photos Discovered", value: photos.length, color: "text-primary", desc: "Across all event archives" },
                { label: "Favorite Shots", value: photos.filter((p) => p.is_favorite).length, color: "text-emerald-400", desc: "Best memories highlighted" },
                { label: "Communities Tagged", value: communitiesList.length, color: "text-white", desc: "Distinct groups joined" },
                { label: "Potential Matches", value: pendingPhotos.length, color: "text-amber-400", desc: "Awaiting face confirmation" },
              ].map((stat) => (
                <div key={stat.label} className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">{stat.label}</span>
                  <div>
                    <span className={`text-2xl font-display font-bold ${stat.color} mt-1 block`}>{stat.value}</span>
                    <span className="text-[9px] text-gray-500 block truncate mt-1">{stat.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Module 5: Potential Matches Review Queue */}
          {!isLoading && pendingPhotos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white font-display">Match Review Queue</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 font-bold uppercase tracking-wider">
                  Needs Confirmation
                </span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {pendingPhotos.map((item, idx) => (
                  <motion.div
                    key={item.match_id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-shrink-0 w-80 rounded-2xl glass-panel border border-white/[0.06] p-4 flex gap-4 items-center group relative overflow-hidden"
                  >
                    <div className="w-20 h-20 rounded-xl overflow-hidden relative flex-shrink-0 cursor-pointer" onClick={() => openLightbox(idx, pendingPhotos)}>
                      <img src={item.file_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-md uppercase">
                          AI: {Math.round(item.confidence * 100)}% Match
                        </span>
                      </div>
                      <span className="text-xs font-bold text-white block truncate">{item.community_title}</span>
                      <span className="text-[10px] text-gray-500 block truncate">{item.album_name || "General Gallery"}</span>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleConfirmMatch(item.match_id)}
                          className="flex-grow py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>Confirm</span>
                        </button>
                        <button
                          onClick={() => handleRejectMatch(item.match_id)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-red-500/25 text-gray-400 hover:text-red-400 text-[10px] font-semibold transition-all flex items-center justify-center"
                          title="Reject match"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Module 13: Filters Deck */}
          <div className="p-4 rounded-2xl glass-panel border border-white/[0.06] flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Section Filter Pills */}
              <div className="flex rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
                {[
                  { key: "all", label: "All Matches" },
                  { key: "favorites", label: "Favorites" },
                  { key: "recent", label: "Recent (24h)" },
                  { key: "activity", label: "Activity Feed" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      activeFilter === tab.key
                        ? "bg-white/[0.06] text-white border border-white/[0.08]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Community Filter Select */}
              {communitiesList.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedCommunity}
                    onChange={(e) => setSelectedCommunity(e.target.value)}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-300 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-[#0a0f1a]">All Workspaces</option>
                    {communitiesList.map((comm) => (
                      <option key={comm} value={comm} className="bg-[#0a0f1a]">
                        {comm}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Confidence Threshold Pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <Filter className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Confidence ≥ {confidenceFilter}%
                </span>
                <input
                  type="range"
                  min="75"
                  max="95"
                  value={confidenceFilter}
                  onChange={(e) => setConfidenceFilter(parseInt(e.target.value))}
                  className="w-16 h-1 bg-white/[0.08] rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Live Search */}
            <div className="relative w-full md:w-60">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search matched photos..."
                className="w-full h-9 bg-white/[0.03] border border-white/[0.08] rounded-xl pl-3 pr-8 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Module 13: Pinterest Masonry Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Discovering face matches...</span>
            </div>
          ) : activeFilter === "activity" ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {activityFeed.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3 text-center">
                  <Clock className="w-8 h-8 text-gray-600 animate-pulse" />
                  <span className="text-xs text-gray-400 uppercase font-bold">No activity history recorded yet</span>
                </div>
              ) : (
                activityFeed.map((activity, idx) => (
                  <div key={idx} className="flex gap-4 p-5 rounded-2xl glass-panel border border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.01] transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-primary flex-shrink-0">
                      {activity.type === "match_found" ? <Camera className="w-5 h-5 text-primary" /> : <Sparkles className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white block">{activity.title}</span>
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{activity.relative_date}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{activity.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-5 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center max-w-lg mx-auto">
              <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-gray-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">No personal photos found</h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Make sure you have completed face verification in communities first to build your liveness profile, and hosts have triggered matching analysis jobs.
                </p>
              </div>
              <button
                onClick={() => router.push("/dashboard/discover")}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-lg shadow-primary/10"
              >
                Explore Communities
              </button>
            </div>
          ) : (
            <>
              <div className="columns-1 md:columns-2 lg:columns-3 gap-5 space-y-5">
                {filteredPhotos.map((photo, index) => (
                  <motion.div
                    key={photo.match_id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
                    className="break-inside-avoid rounded-2xl glass-panel border border-white/[0.06] hover:border-white/[0.10] overflow-hidden group cursor-pointer relative flex flex-col"
                    onClick={() => openLightbox(index, filteredPhotos)}
                  >
                    <img src={getOptimizedImageUrl(photo.file_url, 300)} alt="" loading="lazy" className="w-full object-cover transition-transform duration-500 group-hover:scale-102" />
                    
                    {/* Confidence Badge overlay */}
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur border border-white/[0.08] text-[9px] font-bold text-emerald-400 flex items-center gap-1 z-10">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{Math.round(photo.confidence * 100)}% Match</span>
                    </div>

                    {/* Actions overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{photo.community_title}</span>
                          <span className="text-xs font-bold text-white block truncate">{photo.title || photo.album_name || "Personal Gallery Photo"}</span>
                        </div>
                        
                        {/* Floating actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={(e) => handleFavoriteMatch(photo.match_id, e)}
                            className={`p-1.5 rounded-lg bg-black/40 border border-white/[0.08] transition-all hover:bg-black/60 ${
                              photo.is_favorite ? "text-emerald-400 border-emerald-500/20" : "text-gray-400 hover:text-white"
                            }`}
                          >
                            <Heart className="w-3.5 h-3.5" fill={photo.is_favorite ? "currentColor" : "none"} />
                          </button>
                          <button
                            onClick={(e) => handleHideMatch(photo.match_id, e)}
                            className="p-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-gray-400 hover:text-white transition-all hover:bg-black/60"
                            title="Hide photo"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRejectMatch(photo.match_id); }}
                            className="p-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-gray-400 hover:text-red-400 transition-all hover:bg-black/60"
                            title="Report wrong match"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {/* Infinite Scroll loading indicator and sentinel observer */}
              {hasMore && activeFilter === "all" && (
                <div ref={observerRef} className="flex justify-center py-8">
                  {isFetchingMore ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-bold uppercase tracking-wider">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading more photos...</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest animate-pulse">Scroll to load more</span>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </main>



      {/* Module 13: Lightbox Viewer */}
      <AnimatePresence>
        {lightboxIndex !== null && activeGalleryList.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxIndex(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur"
            />
            
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 z-50 p-2"
              title="Close viewer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation arrows */}
            {lightboxIndex > 0 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 z-50 p-2 text-xl font-extrabold"
              >
                ◀
              </button>
            )}
            {lightboxIndex < activeGalleryList.length - 1 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 z-50 p-2 text-xl font-extrabold"
              >
                ▶
              </button>
            )}

            {/* Image display */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl max-h-[85vh] w-full flex flex-col md:flex-row glass-panel border border-white/[0.08] rounded-2xl overflow-hidden z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-grow bg-black flex items-center justify-center min-h-[300px] max-h-[60vh] md:max-h-[85vh]">
                <img
                  src={activeGalleryList[lightboxIndex].file_url}
                  alt=""
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="w-full md:w-80 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/[0.06] bg-[#0a0f1a]/95">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                      {activeGalleryList[lightboxIndex].community_title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold">
                      {Math.round(activeGalleryList[lightboxIndex].confidence * 100)}% Match
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white font-display">
                      {activeGalleryList[lightboxIndex].title || activeGalleryList[lightboxIndex].album_name || "Gallery Photo"}
                    </h3>
                    {activeGalleryList[lightboxIndex].album_name && (
                      <span className="text-[10px] text-gray-500 block mt-1">
                        Album: {activeGalleryList[lightboxIndex].album_name}
                      </span>
                    )}
                    <span className="text-[9px] text-gray-600 block mt-1 uppercase tracking-wider">
                      Uploaded {new Date(activeGalleryList[lightboxIndex].created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {activeGalleryList[lightboxIndex].description && (
                    <p className="text-xs text-gray-400 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                      "{activeGalleryList[lightboxIndex].description}"
                    </p>
                  )}
                </div>

                {/* Lightbox Controls */}
                <div className="space-y-2.5 pt-6 border-t border-white/[0.06]">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(activeGalleryList[lightboxIndex].file_url, activeGalleryList[lightboxIndex].title || "facesnap")}
                      className="flex-grow py-2 rounded-xl bg-primary hover:bg-cyan-400 text-black text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                    <button
                      onClick={() => {
                        fetchConversationsForShare();
                        setShowShareModal(true);
                      }}
                      className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] text-gray-300 flex items-center justify-center"
                      title="Share in Chat"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {activeGalleryList[lightboxIndex].status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirmMatch(activeGalleryList[lightboxIndex].match_id)}
                        className="flex-grow py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Confirm Match</span>
                      </button>
                      <button
                        onClick={() => handleRejectMatch(activeGalleryList[lightboxIndex].match_id)}
                        className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-red-500/25 text-gray-400 hover:text-red-400 text-xs font-semibold flex items-center justify-center"
                        title="Reject match"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFavoriteMatch(activeGalleryList[lightboxIndex].match_id)}
                        className={`flex-grow py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                          activeGalleryList[lightboxIndex].is_favorite
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-white/[0.03] border-white/[0.08] text-gray-300 hover:text-white"
                        }`}
                      >
                        <Heart className="w-3.5 h-3.5" fill={activeGalleryList[lightboxIndex].is_favorite ? "currentColor" : "none"} />
                        <span>{activeGalleryList[lightboxIndex].is_favorite ? "Favorited" : "Favorite"}</span>
                      </button>
                      <button
                        onClick={() => handleHideMatch(activeGalleryList[lightboxIndex].match_id)}
                        className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white flex items-center justify-center"
                        title="Hide photo from gallery"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {activeGalleryList[lightboxIndex].status !== "pending" && (
                    <button
                      onClick={() => handleRejectMatch(activeGalleryList[lightboxIndex].match_id)}
                      className="w-full py-2 rounded-xl bg-white/[0.03] border border-dashed border-red-500/20 hover:border-red-500/40 text-red-500/70 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Report Wrong Match</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className={`fixed bottom-6 left-1/2 z-[200] px-5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-2xl border ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share in Private Chat Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-sm rounded-2xl glass-panel border border-white/[0.08] p-6 relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-secondary rounded-t-2xl" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-bold text-white font-display">Share in Private Chat</h2>
                </div>
                <button onClick={() => setShowShareModal(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {conversationsForShare.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-400">No active conversations found.</p>
                  <p className="text-[10px] text-gray-500">Go to Private Chat to connect with users first!</p>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Choose Recipient</label>
                    <select
                      value={selectedConvForShare}
                      onChange={(e) => setSelectedConvForShare(e.target.value)}
                      className="w-full bg-[#0a0f1a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-primary/50"
                    >
                      {conversationsForShare.map((conv) => {
                        const otherUser = conv.participants.find((p: any) => p.user_id !== user?.id)?.user;
                        return (
                          <option key={conv.id} value={conv.id} className="bg-[#0a0f1a]">
                            {otherUser ? otherUser.full_name : "Private Chat"}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowShareModal(false)}
                      className="flex-grow py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold text-gray-300 font-display transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleShareInChat}
                      disabled={isSendingShare}
                      className="flex-grow flex items-center justify-center gap-2 py-2 rounded-xl bg-primary hover:bg-cyan-400 text-black text-xs font-bold font-display transition-all"
                    >
                      {isSendingShare ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Photo"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
