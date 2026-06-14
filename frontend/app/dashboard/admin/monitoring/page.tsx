"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Loader2, Home, Compass, Search, LogOut, RefreshCw,
  Server, Activity, CheckCircle2, AlertTriangle, XCircle, Clock,
  Database, DatabaseBackup, Zap, Mail, BarChart3, Globe,
  UserCheck, Download, Trash2, ShieldAlert, Cpu, Eye, ArrowUpRight, Camera, MessageSquare, Smartphone
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TelemetryStats {
  user_activity: {
    dau: number;
    wau: number;
    mau: number;
    total_users: number;
    active_communities: number;
    active_events: number;
  };
  api_performance: {
    total_hits: number;
    average_ms: number;
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    error_rate_pct: number;
    total_errors: number;
    heatmap: {
      endpoint: string;
      method: string;
      hits: number;
      avg_duration_ms: number;
      errors: number;
    }[];
  };
  search_quality: {
    total_searches: number;
    zero_results_pct: number;
    average_duration_ms: number;
    popular_queries: { query: string; hits: number }[];
  };
  face_recognition: {
    matches_created: number;
    matches_approved: number;
    matches_rejected: number;
    false_positive_pct: number;
    average_matching_time_sec: number;
  };
  notifications: {
    sent: number;
    opened: number;
    clicked: number;
    open_rate_pct: number;
    ctr_pct: number;
  };
  storage: {
    photos_mb: number;
    videos_mb: number;
    database_mb: number;
    total_mb: number;
  };
}

interface ErrorLog {
  id: string;
  message: string;
  traceback?: string;
  endpoint?: string;
  method?: string;
  ip_address?: string;
  created_at: string;
  user_email?: string;
}

type TabKey = "overview" | "api-heat" | "search-qual" | "error-console";

export default function AdminMonitoringPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [uptimes, setUptimes] = useState<Record<string, any>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Inspect modals
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);

  // Pagination for errors
  const [errorsOffset, setErrorsOffset] = useState(0);

  // Guard: super_admin only
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (user && user.platform_role !== "super_admin") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [isAuthenticated, user]);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchErrorLogs(), fetchUptimeStats()]);
    setIsLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/api/v1/monitoring/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) { logout(); router.push("/auth/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch monitoring stats:", err);
    }
  };

  const fetchErrorLogs = async (offset = 0) => {
    try {
      const res = await fetch(`${API}/api/v1/monitoring/errors?limit=25&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setErrors(data);
        setErrorsOffset(offset);
      }
    } catch (err) {
      console.error("Failed to fetch error logs:", err);
    }
  };

  const fetchUptimeStats = async () => {
    try {
      const res = await fetch(`${API}/api/v1/monitoring/uptime`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUptimes(data);
      }
    } catch (err) {
      console.error("Failed to fetch uptimes:", err);
    }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePurgeLogs = async () => {
    if (!confirm("Are you sure you want to delete historical telemetry logs older than 7 days?")) return;
    setActionLoading("purge");
    try {
      const res = await fetch(`${API}/api/v1/monitoring/purge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to purge historical metrics.");
      showToast(data.message || "Historical telemetry logs purged successfully.", "success");
      fetchData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = (type: string, format: "csv" | "xlsx") => {
    const url = `${API}/api/v1/monitoring/export?export_type=${type}&export_format=${format}`;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then(blob => {
        const fileUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = `monitoring_export_${type}_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("✓ Report downloaded successfully!", "success");
      })
      .catch(err => {
        showToast("Failed to compile monitoring export.", "error");
      });
  };

  const filteredErrors = errors.filter(err => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      err.message.toLowerCase().includes(query) ||
      (err.endpoint && err.endpoint.toLowerCase().includes(query)) ||
      (err.method && err.method.toLowerCase().includes(query)) ||
      (err.user_email && err.user_email.toLowerCase().includes(query))
    );
  });

  if (!isAuthenticated || !user) return null;
  if (user.platform_role !== "super_admin") return null;

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">

      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-white/[0.08]">
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider text-white">FaceSnap</span>
              <span className="block text-[7px] tracking-[0.2em] text-emerald-400 font-bold uppercase -mt-0.5">
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
            <Camera className="w-4 h-4" />
            <span>My Photos</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/chat")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Private Chat</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/search")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Search className="w-4 h-4" />
            <span>Smart Search</span>
          </button>
        </nav>

        <div className="px-3 mt-2">
          <div className="px-3 py-2">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Admin Panel</span>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => router.push("/dashboard/admin")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Community Requests</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/jobs")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>Jobs Queue</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/security")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Shield className="w-4 h-4" />
              <span>Security Controls</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/status")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Activity className="w-4 h-4" />
              <span>Uptime Status</span>
            </button>
            <button
              onClick={() => {}}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-all font-semibold"
            >
              <Server className="w-4 h-4 text-emerald-400" />
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="text-xs font-bold text-white block truncate">{user?.full_name}</span>
              <span className="text-[10px] text-emerald-400 block truncate font-semibold">Super Admin</span>
            </div>
            <button
              onClick={() => { logout(); router.push("/"); }}
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
      <main className="flex-grow overflow-y-auto min-h-screen z-10">

        {/* Header */}
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Enterprise Telemetry & Observability
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                Metrics rollups, Search Quality, and Errors Console
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-gray-300 font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync Telemetry</span>
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

          {/* Quick Metrics Banner */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "P95 Response Latency", value: `${stats.api_performance.p95_ms}ms`, color: "text-cyan-400", bg: "bg-cyan-500/[0.04]", border: "border-cyan-500/[0.12]", icon: Clock },
                { label: "API Error Rate", value: `${stats.api_performance.error_rate_pct}%`, color: "text-red-400", bg: "bg-red-500/[0.04]", border: "border-red-500/[0.12]", icon: ShieldAlert },
                { label: "Zero-Result Searches", value: `${stats.search_quality.zero_results_pct}%`, color: "text-amber-400", bg: "bg-amber-500/[0.04]", border: "border-amber-500/[0.12]", icon: Search },
                { label: "Total Storage Allocated", value: `${stats.storage.total_mb} MB`, color: "text-emerald-400", bg: "bg-emerald-500/[0.04]", border: "border-emerald-500/[0.12]", icon: Database }
              ].map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div key={idx} className={`p-4 rounded-2xl ${m.bg} border ${m.border} flex items-center justify-between`}>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{m.label}</span>
                      <span className={`text-xl font-display font-extrabold ${m.color} mt-1 block`}>{m.value}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <Icon className={`w-4 h-4 ${m.color}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Toast Notification */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-xl text-xs font-semibold shadow-2xl ${
                  toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{toast.msg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                { key: "overview", label: "Overview & Storage", icon: Server },
                { key: "api-heat", label: "API heatmaps", icon: BarChart3 },
                { key: "search-qual", label: "Search Quality", icon: Search },
                { key: "error-console", label: "Error Console", icon: ShieldAlert }
              ] as { key: TabKey; label: string; icon: any }[]).map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setSearchQuery(""); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all ${
                      isActive
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold"
                        : "text-gray-300 hover:text-white hover:bg-white/[0.03] border border-transparent"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Error Console search filter */}
            {activeTab === "error-console" && (
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter logs by trace or endpoint..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white/[0.03] border border-white/[0.08] focus:border-emerald-500/40 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                />
              </div>
            )}
          </div>

          {/* Main loader */}
          {isLoading ? (
            <div className="flex items-center justify-center py-32 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Querying platform telemetry...</span>
            </div>
          ) : (
            <div className="space-y-6">

              {/* OVERVIEW TAB */}
              {activeTab === "overview" && stats && (
                <div className="space-y-6">
                  {/* Uptime indicators summary */}
                  <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Service Health & Rolling Uptime</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(uptimes).map(([name, uptime]: [string, any]) => (
                        <div key={name} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center space-y-1">
                          <span className="text-xs font-bold text-white capitalize font-display">{name}</span>
                          <div className="py-2">
                            <span className="text-xl font-extrabold text-emerald-400">{uptime.uptime_24h}%</span>
                            <span className="block text-[8px] text-gray-500 uppercase font-bold tracking-wider mt-1">24h Uptime</span>
                          </div>
                          <div className="flex justify-around text-[9px] text-gray-400 border-t border-white/[0.04] pt-2">
                            <span>7d: {uptime.uptime_7d}%</span>
                            <span>30d: {uptime.uptime_30d}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Storage Allocation & User telemetry */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Storage info */}
                    <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Storage Capacity Allocation</span>
                        <DatabaseBackup className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: "Photo Bucket Assets", size: stats.storage.photos_mb, total: stats.storage.total_mb, color: "bg-emerald-500" },
                          { label: "Video Album Uploads", size: stats.storage.videos_mb, total: stats.storage.total_mb, color: "bg-cyan-500" },
                          { label: "PostgreSQL Database Engine", size: stats.storage.database_mb, total: stats.storage.total_mb, color: "bg-indigo-500" }
                        ].map((s, i) => {
                          const pct = s.total > 0 ? (s.size / s.total * 100) : 0;
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-gray-300">{s.label}</span>
                                <span className="font-bold text-white">{s.size} MB ({roundVal(pct)}%)</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                                <div className={`h-full ${s.color} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active users dashboard */}
                    <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">User Engagements (DAU/WAU/MAU)</span>
                        <Cpu className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-2">
                        {[
                          { label: "Daily Active", val: stats.user_activity.dau, color: "text-emerald-400" },
                          { label: "Weekly Active", val: stats.user_activity.wau, color: "text-cyan-400" },
                          { label: "Monthly Active", val: stats.user_activity.mau, color: "text-indigo-400" }
                        ].map((u, i) => (
                          <div key={i} className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">{u.label}</span>
                            <span className={`text-xl font-extrabold mt-1 block ${u.color}`}>{u.val}</span>
                            <span className="text-[9px] text-gray-500 mt-1 block">
                              {roundVal(u.val / stats.user_activity.total_users * 100)}% of total
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Manual Purge controls */}
                  <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-white block">Historical Telemetry Purge</span>
                      <p className="text-[11px] text-gray-400 mt-0.5 max-w-xl">
                        Clean up the performance metrics database logs and uptime entries older than 7 days manually to release storage space.
                      </p>
                    </div>
                    <button
                      onClick={handlePurgeLogs}
                      disabled={actionLoading === "purge"}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/40 rounded-xl text-xs font-bold text-red-400 transition-all shrink-0 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{actionLoading === "purge" ? "Purging..." : "Purge Logs"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* API HEATMAPS TAB */}
              {activeTab === "api-heat" && stats && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Top Endpoints Activity Heap</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExport("api_metrics", "csv")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export CSV</span>
                      </button>
                      <button
                        onClick={() => handleExport("api_metrics", "xlsx")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                      >
                        <Download className="w-3 h-3 text-emerald-400" />
                        <span>Export Excel</span>
                      </button>
                    </div>
                  </div>

                  {stats.api_performance.heatmap.length === 0 ? (
                    <div className="py-20 text-center rounded-2xl glass-panel border border-dashed border-white/[0.06] text-gray-400 text-sm">
                      No API request logs recorded on the platform.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 backdrop-blur-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            <th className="px-5 py-3">Route Endpoint</th>
                            <th className="px-5 py-3">Method</th>
                            <th className="px-5 py-3">Hits Count</th>
                            <th className="px-5 py-3">Average Speed</th>
                            <th className="px-5 py-3">Errors Triggered</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] text-xs">
                          {stats.api_performance.heatmap.map((item, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-5 py-3 font-mono text-gray-300">{item.endpoint}</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  item.method === "POST" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                }`}>
                                  {item.method}
                                </span>
                              </td>
                              <td className="px-5 py-3 font-bold text-white">{item.hits}</td>
                              <td className="px-5 py-3 font-mono font-bold text-cyan-300">{item.avg_duration_ms}ms</td>
                              <td className="px-5 py-3">
                                <span className={`font-semibold ${item.errors > 0 ? "text-red-400 font-extrabold" : "text-gray-500"}`}>
                                  {item.errors}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SEARCH QUALITY TAB */}
              {activeTab === "search-qual" && stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Search analytics */}
                  <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Smart Search Performance</span>
                    <div className="space-y-4">
                      {[
                        { label: "Total Queries Run (24h)", val: stats.search_quality.total_searches },
                        { label: "Average Search speed", val: `${stats.search_quality.average_duration_ms}ms` },
                        { label: "Zero-Result searches ratio", val: `${stats.search_quality.zero_results_pct}%`, warning: stats.search_quality.zero_results_pct > 20 }
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                          <span className="text-xs text-gray-300 font-medium">{item.label}</span>
                          <span className={`text-sm font-extrabold ${item.warning ? "text-amber-400" : "text-white"}`}>
                            {item.val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trending Queries */}
                  <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Popular Search Terms (24h)</span>
                    {stats.search_quality.popular_queries.length === 0 ? (
                      <div className="py-10 text-center text-xs text-gray-500">No search terms recorded.</div>
                    ) : (
                      <div className="space-y-2">
                        {stats.search_quality.popular_queries.map((q, idx) => (
                          <div key={idx} className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-300">"{q.query}"</span>
                            <span className="text-xs font-bold text-emerald-400">{q.hits} hits</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ERROR CONSOLE TAB */}
              {activeTab === "error-console" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Exceptions Error Registry</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExport("error_logs", "csv")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export CSV</span>
                      </button>
                      <button
                        onClick={() => handleExport("error_logs", "xlsx")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                      >
                        <Download className="w-3 h-3 text-emerald-400" />
                        <span>Export Excel</span>
                      </button>
                    </div>
                  </div>

                  {filteredErrors.length === 0 ? (
                    <div className="py-20 text-center rounded-2xl glass-panel border border-dashed border-white/[0.06] text-gray-400 text-sm">
                      No unhandled error exceptions logged in the platform registry.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredErrors.map((err) => (
                        <div
                          key={err.id}
                          className="p-5 rounded-2xl glass-panel border border-white/[0.06] hover:border-white/[0.10] transition-all duration-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {err.method && (
                                <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold uppercase text-[9px]">
                                  {err.method}
                                </span>
                              )}
                              {err.endpoint && (
                                <span className="text-xs text-gray-300 font-mono">{err.endpoint}</span>
                              )}
                              {err.ip_address && (
                                <span className="text-[10px] text-gray-500 font-mono">IP: {err.ip_address}</span>
                              )}
                            </div>
                            <p className="text-xs text-red-300 font-medium leading-relaxed max-w-2xl">{err.message}</p>
                            
                            {err.user_email && (
                              <div className="text-[10px] text-gray-400">
                                Affected User: <span className="font-semibold text-white">{err.user_email}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-end gap-2 shrink-0">
                            <span className="text-[10px] text-gray-500 font-medium">
                              {new Date(err.created_at).toLocaleString()}
                            </span>
                            <button
                              onClick={() => setSelectedError(err)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-all mt-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect stack</span>
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Pagination load more */}
                      {errors.length >= 25 && (
                        <div className="flex justify-center pt-2">
                          <button
                            onClick={() => fetchErrorLogs(errorsOffset + 25)}
                            className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-xs font-semibold transition-all"
                          >
                            Load Next Page
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </main>

      {/* ====== TRACEBACK INSPECTOR MODAL ====== */}
      <AnimatePresence>
        {selectedError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl rounded-3xl glass-panel border border-white/[0.08] bg-[#0c1222]/95 overflow-hidden shadow-2xl"
            >
              {/* Modal header */}
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <span className="font-bold text-white text-sm font-display">Stack Traceback Inspector</span>
                </div>
                <button
                  onClick={() => setSelectedError(null)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition-all"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/10 text-xs space-y-1">
                  <span className="block font-bold text-red-300 uppercase tracking-widest text-[9px]">Exception Message</span>
                  <p className="text-white font-medium">{selectedError.message}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block pl-1">Route Context</span>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[11px] font-mono text-gray-300 space-y-1">
                    <p>Endpoint: {selectedError.endpoint || "N/A"} ({selectedError.method || "N/A"})</p>
                    <p>Client IP: {selectedError.ip_address || "N/A"}</p>
                    <p>Timestamp: {new Date(selectedError.created_at).toLocaleString()}</p>
                    <p>User Email: {selectedError.user_email || "Anonymous"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block pl-1">Python Stack Trace</span>
                  <pre className="p-4 rounded-xl bg-[#030712] border border-white/[0.04] text-[10px] font-mono text-red-400 overflow-x-auto leading-relaxed max-h-[300px]">
                    {selectedError.traceback || "No Python traceback log found."}
                  </pre>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function roundVal(num: number) {
  return Math.round(num * 100) / 100;
}
