"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, CheckCircle2, XCircle, Clock, Loader2,
  LogOut, Camera, Home, Compass, ChevronRight, RefreshCw,
  AlertCircle, Check, X, Building2, Mail, BookOpen, BarChart3,
  Globe, UserCheck, Calendar, MessageSquare, Search, Cpu,
  Activity, Server, DatabaseBackup, Smartphone, Trash2, Bell
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CommunityAccessRequest {
  id: string;
  user_id: string;
  status: string;
  full_name?: string;
  email?: string;
  college?: string;
  purpose?: string;
  reason?: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    username: string;
    email: string;
  };
}

type TabKey = "community-requests" | "stats";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabKey>("community-requests");
  const [communityRequests, setCommunityRequests] = useState<CommunityAccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // Guard: only super_admin can access
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (user && user.platform_role !== "super_admin") {
      router.push("/dashboard");
      return;
    }
    fetchCommunityRequests();
  }, [isAuthenticated, user]);

  const fetchCommunityRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/communities/access-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); router.push("/auth/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setCommunityRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch community access requests:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleReviewCommunityRequest = async (requestId: string, status: "approved" | "rejected") => {
    setReviewingId(requestId);
    try {
      const res = await fetch(`${API}/api/v1/communities/access-requests/${requestId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to process request.");
      showToast(
        status === "approved"
          ? "✓ Request approved — user can now create communities."
          : "Request rejected.",
        status === "approved" ? "success" : "error"
      );
      await fetchCommunityRequests();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setReviewingId(null);
    }
  };

  const handleDeleteAccessRequest = async (requestId: string) => {
    if (!confirm("Are you sure you want to completely delete this request?")) return;
    try {
      const res = await fetch(`${API}/api/v1/communities/access-requests/${requestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      let data = null;
      if (res.status !== 204) {
        data = await res.json();
      }

      if (!res.ok) throw new Error(data?.detail || "Failed to delete request.");
      
      showToast("Request permanently deleted.", "success");
      await fetchCommunityRequests();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleSignOut = () => { logout(); router.push("/"); };

  const filteredRequests = communityRequests.filter((r) =>
    filterStatus === "all" ? true : r.status === filterStatus
  );

  const pendingCount = communityRequests.filter((r) => r.status === "pending").length;
  const approvedCount = communityRequests.filter((r) => r.status === "approved").length;
  const rejectedCount = communityRequests.filter((r) => r.status === "rejected").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/10 border-amber-500/25 text-amber-400";
      case "approved":
        return "bg-emerald-500/10 border-emerald-500/25 text-emerald-400";
      case "rejected":
        return "bg-red-500/10 border-red-500/25 text-red-400";
      default:
        return "bg-white/[0.04] border-white/[0.08] text-gray-400";
    }
  };

  if (!isAuthenticated || !user) return null;
  if (user.platform_role !== "super_admin") return null;

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">

      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-red-500/20 to-amber-500/20 border border-white/[0.08]">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider text-white">FaceSnap</span>
              <span className="block text-[7px] tracking-[0.2em] text-amber-400 font-bold uppercase -mt-0.5">
                Super Admin
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
            onClick={() => router.push("/dashboard/my-photos")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
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
          <button
            onClick={() => router.push("/dashboard/search")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Search className="w-4 h-4 text-cyan-400" />
            <span>Smart Search</span>
          </button>
        </nav>

        <div className="px-3 mt-2">
          <div className="px-3 py-2">
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Admin Panel</span>
          </div>
          <div className="space-y-1">
            {([
              { key: "community-requests", label: "Community Requests", icon: UserCheck, badge: pendingCount },
              { key: "stats", label: "Platform Stats", icon: BarChart3 },
            ] as { key: TabKey; label: string; icon: any; badge?: number }[]).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-200 ${
                    isActive
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "text-gray-300 hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/25">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => router.push("/dashboard/admin/jobs")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Activity className="w-4 h-4" />
              <span>Background Jobs</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/notifications")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Bell className="w-4 h-4" />
              <span>Notification Analytics</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/security")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Security Controls</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/status")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Uptime Status</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/monitoring")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Server className="w-4 h-4 text-cyan-400" />
              <span>System Monitor</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/infrastructure")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Cpu className="w-4 h-4 text-amber-500" />
              <span>Infra Controls</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/recovery")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <DatabaseBackup className="w-4 h-4 text-amber-400" />
              <span>Backup & Recovery</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/pwa")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Smartphone className="w-4 h-4 text-purple-400" />
              <span>Mobile & PWA</span>
            </button>
          </div>
        </div>

        <div className="mt-auto px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="text-xs font-bold text-white block truncate">{user?.full_name}</span>
              <span className="text-[10px] text-amber-400 block truncate font-semibold">Super Admin</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[9px] text-gray-500 text-center font-mono mt-2">FaceSnap v1.0.0</div>
        </div>
      </aside>

      {/* ====== MAIN CONTENT ====== */}
      <main className="flex-grow overflow-y-auto min-h-screen">

        {/* Header */}
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Super Admin Dashboard
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                Platform Control Center
              </p>
            </div>
          </div>
          <button
            onClick={fetchCommunityRequests}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-gray-300 font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Requests", value: communityRequests.length, color: "text-white", bg: "bg-white/[0.04]", border: "border-white/[0.08]" },
              { label: "Pending Review", value: pendingCount, color: "text-amber-400", bg: "bg-amber-500/[0.04]", border: "border-amber-500/[0.12]" },
              { label: "Approved", value: approvedCount, color: "text-emerald-400", bg: "bg-emerald-500/[0.04]", border: "border-emerald-500/[0.12]" },
              { label: "Rejected", value: rejectedCount, color: "text-red-400", bg: "bg-red-500/[0.04]", border: "border-red-500/[0.12]" },
            ].map((stat) => (
              <div key={stat.label} className={`p-4 rounded-xl ${stat.bg} border ${stat.border}`}>
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">{stat.label}</span>
                <span className={`text-2xl font-display font-bold ${stat.color} mt-1 block`}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Tab: Community Requests */}
          {activeTab === "community-requests" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-white font-display">Community Host Requests</h2>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterStatus(f)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        filterStatus === f
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                          : "bg-white/[0.03] border-white/[0.08] text-gray-400 hover:text-white"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20 gap-3">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                  <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Loading requests...</span>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl glass-panel border border-dashed border-white/[0.06]">
                  <CheckCircle2 className="w-10 h-10 text-gray-600" />
                  <span className="text-sm font-medium text-gray-400">
                    No {filterStatus !== "all" ? filterStatus : ""} requests found.
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((req, i) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="p-5 rounded-2xl glass-panel border border-white/[0.06] hover:border-white/[0.10] transition-all duration-300 group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: User Info */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-red-500/15 border border-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-400 flex-shrink-0">
                            {req.user?.full_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <span className="text-sm font-bold text-white">{req.user?.full_name}</span>
                              <span className="text-xs text-amber-400/80 font-semibold">@{req.user?.username}</span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${getStatusBadge(req.status)}`}>
                                {req.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                              {req.user?.email && (
                                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                  <Mail className="w-3 h-3" />
                                  {req.user.email}
                                </span>
                              )}
                              {req.college && (
                                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                  <Building2 className="w-3 h-3" />
                                  {req.college}
                                </span>
                              )}
                              {req.purpose && (
                                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                  <BookOpen className="w-3 h-3" />
                                  {req.purpose}
                                </span>
                              )}
                            </div>
                            {req.reason && (
                              <p className="text-[11px] text-gray-300 mt-2 leading-relaxed max-w-xl p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                "{req.reason}"
                              </p>
                            )}
                            <span className="text-[9px] text-gray-500 block mt-2 uppercase tracking-wider font-semibold">
                              Submitted {new Date(req.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>

                        {/* Right: Action Buttons */}
                        {req.status === "pending" && (
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleReviewCommunityRequest(req.id, "approved")}
                              disabled={reviewingId === req.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                            >
                              {reviewingId === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleReviewCommunityRequest(req.id, "rejected")}
                              disabled={reviewingId === req.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.08] hover:border-red-500/25 text-gray-400 hover:text-red-400 text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                        {req.status !== "pending" && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleDeleteAccessRequest(req.id)}
                              className="p-2 rounded-xl bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.08] text-gray-400 hover:text-red-400 transition-all shadow-sm"
                              title="Delete Request"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${getStatusBadge(req.status)}`}>
                              {req.status === "approved" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              <span className="capitalize">{req.status}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Stats */}
          {activeTab === "stats" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white font-display">Platform Statistics</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Access Request Breakdown</h3>
                  {[
                    { label: "Pending", value: pendingCount, total: communityRequests.length, color: "bg-amber-500" },
                    { label: "Approved", value: approvedCount, total: communityRequests.length, color: "bg-emerald-500" },
                    { label: "Rejected", value: rejectedCount, total: communityRequests.length, color: "bg-red-500" },
                  ].map((item) => {
                    const pct = communityRequests.length > 0 ? Math.round((item.value / communityRequests.length) * 100) : 0;
                    return (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400 font-medium">{item.label}</span>
                          <span className="text-xs font-bold text-white">{item.value} <span className="text-gray-500 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/[0.04]">
                          <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-3">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Admin Quick Actions</h3>
                  <p className="text-xs text-gray-400">Use these shortcuts to manage the platform efficiently.</p>
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => { setActiveTab("community-requests"); setFilterStatus("pending"); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 text-amber-400 text-xs font-semibold transition-all text-left"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Review Pending Requests ({pendingCount})</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/discover")}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-gray-300 text-xs font-semibold transition-all text-left"
                    >
                      <Globe className="w-4 h-4" />
                      <span>View All Communities</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/admin/jobs")}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 text-amber-400 text-xs font-semibold transition-all text-left"
                    >
                      <Cpu className="w-4 h-4 text-amber-400" />
                      <span>Monitor Tasks Queue</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/admin/security")}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 text-amber-400 text-xs font-semibold transition-all text-left"
                    >
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>Security Controls</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/admin/status")}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 text-emerald-400 text-xs font-semibold transition-all text-left"
                    >
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Platform Uptime Status</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/admin/monitoring")}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 text-cyan-400 text-xs font-semibold transition-all text-left"
                    >
                      <Server className="w-4 h-4 text-cyan-400" />
                      <span>Ecosystem Telemetry Monitor</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className={`fixed bottom-6 left-1/2 z-[200] px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2.5 shadow-2xl border ${
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
    </div>
  );
}
