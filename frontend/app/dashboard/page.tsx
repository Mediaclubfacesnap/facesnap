"use client";

import React, { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Users, Calendar, MapPin, Bell, Settings, ChevronRight,
  Sparkles, Loader2, Home, Search, Check, X, Camera, LogOut,
  Compass, Globe, Zap, AlertCircle, Shield, Trash2, Activity, MessageSquare
} from "lucide-react";

interface Community {
  id: string;
  title: string;
  description: string;
  category: string;
  banner_url?: string | null;
  creator_id: string;
}

interface Invitation {
  id: string;
  community_id: string;
  community_title?: string;
  inviter_name?: string;
  status: string;
}

interface AppNotification {
  id: string;
  notification_type: string;
  priority: string;
  title: string;
  message: string;
  target_url?: string;
  is_read: boolean;
  notification_dismissed: boolean;
  created_at: string;
}

function DashboardContent() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout, refreshUser } = useAuthStore();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [myGroups, setMyGroups] = useState<Community[]>([]);
  const [myRoles, setMyRoles] = useState<Record<string, string>>({});
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<"home" | "notifications" | "settings">("home");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);

  // Deletion state
  const [deleteCommunityId, setDeleteCommunityId] = useState<string | null>(null);
  const [deleteCommunityTitle, setDeleteCommunityTitle] = useState("");
  const [isDeletingCommunity, setIsDeletingCommunity] = useState(false);

  // Create Community form
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Technology");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

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

  // Modal focus management
  const modalTitleRef = useRef<HTMLInputElement>(null);
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
    refreshUser();
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [commRes, rolesRes, invRes, groupsRes, notifRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-roles`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-invitations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-groups`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (rolesRes.status === 401 || invRes.status === 401 || groupsRes.status === 401 || notifRes.status === 401) {
        logout();
        router.push("/auth/login");
        return;
      }

      if (commRes.ok) setCommunities(await commRes.json());
      if (rolesRes.ok) setMyRoles(await rolesRes.json());
      if (invRes.ok) setInvitations(await invRes.json());
      if (groupsRes.ok) setMyGroups(await groupsRes.json());
      if (notifRes.ok) setNotifications(await notifRes.json());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
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

      const contentType = res.headers.get("content-type");
      const data = contentType?.includes("application/json") ? await res.json() : {};
      if (!res.ok) throw new Error(data.detail || "Failed to create community.");

      setCommunities([data, ...communities]);
      setMyGroups([data, ...myGroups]);
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
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

      const contentType = res.headers.get("content-type");
      const data = contentType?.includes("application/json") ? await res.json() : {};
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
        setMyGroups((prev) => prev.filter((c) => c.id !== deleteCommunityId));
        setDeleteCommunityId(null);
      } else {
        const contentType = res.headers.get("content-type");
        const data = contentType?.includes("application/json") ? await res.json() : {};
        alert(data.detail || "Failed to delete community.");
      }
    } catch (err) {
      console.error("Delete community error:", err);
    } finally {
      setIsDeletingCommunity(false);
    }
  };

  const handleAcceptInvitation = async (invId: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/invitations/${invId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response: "accepted" }),
      });
      setInvitations((prev) => prev.filter((inv) => inv.id !== invId));
      fetchData();
    } catch (err) {
      console.error("Accept invitation error:", err);
    }
  };

  const handleRejectInvitation = async (invId: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/invitations/${invId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response: "rejected" }),
      });
      setInvitations((prev) => prev.filter((inv) => inv.id !== invId));
    } catch (err) {
      console.error("Reject invitation error:", err);
    }
  };

  const handleDismissNotification = async (notifId: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/${notifId}/dismiss`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch (err) {
      console.error("Dismiss notification error:", err);
    }
  };

  const handleSignOut = () => {
    logout();
    router.push("/");
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "host":
        return { label: "Host", color: "bg-secondary/10 border-secondary/25 text-secondary" };
      case "admin":
        return { label: "Admin", color: "bg-primary/10 border-primary/25 text-primary" };
      case "contributor":
        return { label: "Contributor", color: "bg-tertiary/10 border-tertiary/25 text-tertiary" };
      default:
        return { label: "Participant", color: "bg-white/[0.04] border-white/[0.08] text-gray-400" };
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#030712]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const pendingCount = invitations.filter((i) => i.status === "pending").length;

  const sidebarNavItems = [
    { key: "home", label: "Home", icon: Home },
    { key: "discover", label: "My Communities", icon: Users, href: "/dashboard/discover" },
    { key: "search", label: "Smart Search", icon: Search, href: "/dashboard/search" },
    { key: "timeline", label: "Personal Timeline", icon: Activity, href: "/dashboard/timeline" },
    { key: "my-photos", label: "My Photos", icon: Camera, href: "/dashboard/my-photos" },
    { key: "chat", label: "Private Chat", icon: MessageSquare, href: "/dashboard/chat" },
    { key: "notifications", label: "Notifications", icon: Bell, badge: pendingCount },
    { key: "settings", label: "Settings", icon: Settings },
    ...(user?.platform_role === "super_admin"
      ? [{ key: "admin", label: "Admin Panel", icon: Shield, href: "/dashboard/admin" }]
      : []),
  ];

  return (
    <div className="flex min-h-screen bg-[#030712] text-gray-50">
      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen" aria-label="Sidebar navigation">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/15 to-tertiary/15 border border-white/[0.08]">
              <Camera className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-display font-bold tracking-tight text-gray-50">FaceSnap</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="px-3 py-4 space-y-1">
          {sidebarNavItems.map((item) => {
            const isActive = item.key === activeTab;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.href) {
                    router.push(item.href);
                  } else {
                    setActiveTab(item.key as any);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white/[0.06] text-gray-50 border border-white/[0.08]"
                    : "text-gray-400 hover:text-gray-50 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
                <span>{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-xs font-semibold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* MY GROUPS Section */}
        <div className="px-3 mt-2 flex-1 min-h-0">
          <div className="px-3 py-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              My Groups
            </span>
          </div>
          <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
            {myGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => router.push(`/dashboard/my-groups/${group.id}`)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-50 hover:bg-white/[0.03] transition-all duration-200 group"
              >
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/10 to-tertiary/10 border border-white/[0.08] flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                  {group.title.charAt(0)}
                </div>
                <span className="truncate">{group.title}</span>
                <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-600" />
              </button>
            ))}
          </div>
        </div>

        {/* User Profile at Bottom */}
        <div className="mt-auto px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-xs font-semibold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="text-sm font-medium text-gray-50 block truncate">{user?.full_name}</span>
              <span className="text-xs text-gray-500 block truncate">@{user?.username}</span>
            </div>
            <button
              onClick={handleSignOut}
              type="button"
              className="p-1.5 rounded-lg hover:bg-secondary/10 text-gray-500 hover:text-secondary transition-all"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ====== MAIN CONTENT ====== */}
      <div className="flex-grow overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 glass-panel border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <span className="text-sm font-display font-bold text-gray-50">FaceSnap</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("notifications")} className="p-2 rounded-lg bg-white/[0.04] relative" type="button" aria-label="View notifications">
              <Bell className="w-4 h-4 text-gray-300" />
              {pendingCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-secondary" />
              )}
            </button>
            <button onClick={handleSignOut} className="p-2 rounded-lg bg-white/[0.04]" type="button" aria-label="Sign out">
              <LogOut className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm text-gray-400">
                Loading workspace...
              </span>
            </div>
          ) : (
            <>
              {/* ===== HOME TAB ===== */}
              {activeTab === "home" && (
                <div className="space-y-8">
                  {/* Welcome Banner */}
                  <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-[#0a0f1a] to-card border border-white/[0.06] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/[0.03] blur-[80px]" aria-hidden="true" />
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-medium text-emerald-400">
                          System Online
                        </span>
                      </div>
                      <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-50">
                        Welcome back, {user?.full_name?.split(" ")[0]}
                      </h1>
                      <p className="mt-2 text-base text-gray-400">
                        Your workspace is active and ready for photo retrieval.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-5">
                        {(user?.platform_role === "super_admin" || user?.platform_role === "admin" || user?.can_create_communities) ? (
                          <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-[#030712] text-sm font-semibold hover:bg-cyan-400 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            New Community
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowAccessModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 border border-amber-500/25 transition-colors"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Request Host Access
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => router.push("/dashboard/discover")}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] text-gray-300 text-sm font-medium hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                        >
                          <Search className="w-4 h-4" />
                          Discover
                        </button>
                        {user?.platform_role === "super_admin" && (
                          <button
                            type="button"
                            onClick={() => router.push("/dashboard/admin")}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 border border-amber-500/25 transition-colors"
                          >
                            <Shield className="w-4 h-4" />
                            Admin Panel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-xl glass-panel border border-white/[0.06]">
                      <span className="text-xs font-medium text-gray-500">Total Groups</span>
                      <span className="block text-2xl font-display font-bold text-gray-50 mt-1">{myGroups.length}</span>
                    </div>
                    <div className="p-5 rounded-xl glass-panel border border-white/[0.06]">
                      <span className="text-xs font-medium text-gray-500">Pending Invites</span>
                      <span className="block text-2xl font-display font-bold text-primary mt-1">
                        {pendingCount}
                      </span>
                    </div>
                    <div className="p-5 rounded-xl glass-panel border border-white/[0.06] hidden md:block">
                      <span className="text-xs font-medium text-gray-500">System Status</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm font-semibold text-emerald-400">Active</span>
                      </div>
                    </div>
                  </div>

                  {/* MY GROUPS Grid */}
                  <div>
                    <h2 className="text-lg font-display font-semibold text-gray-50 mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-primary" />
                      My Groups
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myGroups?.map((group) => {
                        const role = myRoles[group.id];
                        const badge = getRoleBadge(role);
                        return (
                          <motion.div
                            key={group.id}
                            whileHover={{ y: -2 }}
                            onClick={() => router.push(`/dashboard/my-groups/${group.id}`)}
                            className="rounded-xl glass-panel border border-white/[0.06] card-hover cursor-pointer transition-all duration-300 group relative overflow-hidden"
                          >
                            {/* Accent bar */}
                            <div className="h-1 bg-gradient-to-r from-primary via-tertiary to-secondary rounded-t-xl" aria-hidden="true" />

                            {/* Banner */}
                            <div className="h-20 bg-gradient-to-br from-primary/[0.06] to-tertiary/[0.06] relative overflow-hidden">
                              {group.banner_url && (
                                <img src={group.banner_url} alt="" className="w-full h-full object-cover opacity-30" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />

                              {/* Delete Button */}
                              {(user?.platform_role === "super_admin" || user?.platform_role === "admin" || user?.id === group.creator_id) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDeleteCommunity(group.id, group.title);
                                  }}
                                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur border border-white/[0.08] hover:border-red-500/30 transition-all z-20"
                                  aria-label={`Delete ${group.title}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500 hover:text-red-400" />
                                </button>
                              )}
                            </div>

                            <div className="p-5 -mt-2 relative">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/[0.08] border border-primary/20 text-primary">
                                  {group.category}
                                </span>
                                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </div>

                              <h3 className="text-base font-semibold text-gray-50 group-hover:text-primary transition-colors">
                                {group.title}
                              </h3>
                              <p className="text-sm text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                                {group.description}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}

                      {/* Create New Community Card */}
                      {user?.platform_role === "super_admin" || user?.platform_role === "admin" || user?.can_create_communities ? (
                        <motion.div
                          whileHover={{ y: -2 }}
                          onClick={() => setShowCreateModal(true)}
                          className="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-primary/25 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[200px]"
                        >
                          <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                            <Plus className="w-5 h-5 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-gray-400">Create Community</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          whileHover={{ y: -2 }}
                          onClick={() => setShowAccessModal(true)}
                          className="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-amber-500/25 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[200px]"
                        >
                          <div className="w-10 h-10 rounded-lg bg-amber-500/[0.04] border border-amber-500/[0.08] flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-400">Request Access</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===== NOTIFICATIONS TAB ===== */}
              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-display font-semibold text-gray-50 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    Workspace Invitations
                  </h2>

                  {/* INVITATIONS */}
                  {invitations.filter((inv) => inv.status === "pending").length > 0 && (
                    <div className="grid gap-4 mb-8">
                      {invitations
                        ?.filter((inv) => inv.status === "pending")
                        ?.map((inv) => (
                          <div key={inv.id} className="p-5 rounded-xl glass-panel border border-primary/20 bg-primary/[0.02] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-tertiary/10 border border-white/[0.08] flex items-center justify-center text-sm font-semibold text-primary">
                                {(inv.community_title || "C").charAt(0)}
                              </div>
                              <div>
                                <span className="text-base font-medium text-gray-50">{inv.community_title || "Community Workspace"}</span>
                                {inv.inviter_name && (
                                  <span className="block text-sm text-gray-400 mt-0.5">
                                    Invited by {inv.inviter_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAcceptInvitation(inv.id)}
                                type="button"
                                aria-label={`Accept invitation to ${inv.community_title || "community"}`}
                                className="px-4 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleRejectInvitation(inv.id)}
                                type="button"
                                aria-label={`Reject invitation to ${inv.community_title || "community"}`}
                                className="px-4 py-2.5 rounded-lg bg-secondary/10 text-secondary text-sm font-medium hover:bg-secondary/20 transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  
                  {/* GENERAL NOTIFICATIONS */}
                  <h2 className="text-lg font-display font-semibold text-gray-50 flex items-center gap-2 pt-4 border-t border-white/[0.06]">
                    <Activity className="w-5 h-5 text-tertiary" />
                    Recent Activity
                  </h2>
                  
                  {notifications.filter((n) => !n.notification_dismissed).length === 0 ? (
                    <div className="p-16 rounded-xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center gap-4">
                      <Bell className="w-10 h-10 text-gray-700" />
                      <span className="text-sm text-gray-400">No new notifications</span>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {notifications
                        .filter((n) => !n.notification_dismissed)
                        .map((notif) => {
                           let Icon = Bell;
                           let colorClass = "text-gray-400";
                           let bgClass = "bg-white/[0.04]";
                           
                           if (notif.notification_type === "face_match") {
                               Icon = Camera;
                               colorClass = "text-primary";
                               bgClass = "bg-primary/10 border-primary/20";
                           } else if (notif.notification_type === "community") {
                               Icon = Users;
                               colorClass = "text-tertiary";
                               bgClass = "bg-tertiary/10 border-tertiary/20";
                           } else if (notif.notification_type === "security" || notif.priority === "critical") {
                               Icon = Shield;
                               colorClass = "text-red-400";
                               bgClass = "bg-red-500/10 border-red-500/20";
                           }
                           
                           return (
                             <div key={notif.id} className="p-5 rounded-xl glass-panel border border-white/[0.06] flex items-center justify-between gap-4 group">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${bgClass}`}>
                                      <Icon className={`w-5 h-5 ${colorClass}`} />
                                  </div>
                                  <div>
                                      <span className="text-base font-medium text-gray-50">{notif.title}</span>
                                      <span className="block text-sm text-gray-400 mt-0.5">{notif.message}</span>
                                      <span className="block text-xs text-gray-500 mt-1">{new Date(notif.created_at).toLocaleString()}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {notif.target_url && (
                                      <button
                                        onClick={() => router.push(notif.target_url!)}
                                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm text-gray-300 transition-all"
                                      >
                                        View
                                      </button>
                                  )}
                                  <button
                                    onClick={() => handleDismissNotification(notif.id)}
                                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/10 hover:text-red-400 text-gray-400 transition-all"
                                    aria-label="Dismiss notification"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                             </div>
                           );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* ===== SETTINGS TAB ===== */}
              {activeTab === "settings" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-display font-semibold text-gray-50 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Profile Settings
                  </h2>

                  <div className="p-8 rounded-xl glass-panel border border-white/[0.06]">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-xl font-bold text-white">
                        {user?.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-50">{user?.full_name}</h3>
                        <span className="text-sm text-primary font-medium">@{user?.username}</span>
                        <span className="block text-sm text-gray-400 mt-1">{user?.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <button
                      onClick={() => router.push("/dashboard/settings/notifications")}
                      className="p-5 rounded-xl glass-panel border border-white/[0.06] hover:border-primary/30 transition-all flex items-center gap-4 text-left group"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-50">Notification Preferences</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Manage alerts, emails, and digests.</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500 ml-auto group-hover:text-primary transition-colors" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ====== CREATE COMMUNITY MODAL ====== */}
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
              aria-labelledby="create-community-title"
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

              <h2 id="create-community-title" className="text-lg font-display font-semibold text-gray-50 mb-1">Create Community</h2>
              <p className="text-sm text-gray-400 mb-6">Set up a new workspace for your group.</p>

              {createError && (
                <div className="mb-4 p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-secondary font-medium flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateCommunity} className="space-y-4">
                <div>
                  <label htmlFor="community-title" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Workspace Title
                  </label>
                  <input
                    id="community-title"
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
                  <label htmlFor="community-category" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Category
                  </label>
                  <select
                    id="community-category"
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
                  <label htmlFor="community-description" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="community-description"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                        <span>Submit Request</span>
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
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#030712]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
