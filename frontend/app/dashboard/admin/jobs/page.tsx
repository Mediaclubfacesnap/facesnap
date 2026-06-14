"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Clock, Loader2, LogOut, Camera, Home, Compass,
  ChevronRight, RefreshCw, AlertCircle, CheckCircle2,
  Play, X, BarChart3, Globe, UserCheck, MessageSquare,
  Search, Cpu, PlayCircle, Eye, RefreshCw as RetryIcon,
  Trash2, XCircle, Activity, Server, DatabaseBackup, Smartphone
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BackgroundJob {
  id: string;
  task_id?: string;
  task_name: string;
  queue_name: string;
  status: string;
  priority: number;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  initiated_by?: string;
  worker_name?: string;
  progress: number;
  progress_message?: string;
  result?: any;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  parent_job_id?: string;
  depends_on_job_id?: string;
  meta?: any;
  created_at: string;
}

interface WorkerHealth {
  status: string;
  workers: number;
  active_jobs: number;
  queued_jobs: number;
  details?: any;
}

type FilterStatus = "all" | "queued" | "running" | "completed" | "failed" | "cancelled";

export default function AdminJobsPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({
    queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, paused: 0, total: 0
  });
  const [health, setHealth] = useState<WorkerHealth>({
    status: "offline", workers: 0, active_jobs: 0, queued_jobs: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<BackgroundJob | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

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
    fetchData();
  }, [isAuthenticated, user]);

  // Auto-refresh interval (15 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchJobsQuiet();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, filterStatus]);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchJobs(), fetchStats(), fetchHealth()]);
    setIsLoading(false);
  };

  const fetchJobsQuiet = async () => {
    try {
      const url = filterStatus === "all"
        ? `${API}/api/v1/jobs`
        : `${API}/api/v1/jobs?status_filter=${filterStatus}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
      // Quietly update stats & health
      fetchStats();
      fetchHealth();
    } catch (err) {
      console.error("Quiet refresh failed:", err);
    }
  };

  const fetchJobs = async () => {
    try {
      const url = filterStatus === "all"
        ? `${API}/api/v1/jobs`
        : `${API}/api/v1/jobs?status_filter=${filterStatus}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); router.push("/auth/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/api/v1/jobs/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch job stats:", err);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API}/api/v1/worker-health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error("Failed to fetch worker health:", err);
    }
  };

  // Change filter and refetch
  const handleFilterChange = (status: FilterStatus) => {
    setFilterStatus(status);
    setIsLoading(true);
    // Fetch immediately
    const url = status === "all"
      ? `${API}/api/v1/jobs`
      : `${API}/api/v1/jobs?status_filter=${status}`;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRetryJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const res = await fetch(`${API}/api/v1/jobs/retry/${jobId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to retry job.");
      showToast("✓ Background job re-queued successfully!", "success");
      fetchData();
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(data);
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const res = await fetch(`${API}/api/v1/jobs/cancel/${jobId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to cancel job.");
      showToast("✓ Job cancelled/revoked successfully.", "success");
      fetchData();
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(data);
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSignOut = () => { logout(); router.push("/"); };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "queued":
        return "bg-blue-500/10 border-blue-500/25 text-blue-400";
      case "running":
        return "bg-amber-500/10 border-amber-500/25 text-amber-400 animate-pulse";
      case "completed":
        return "bg-emerald-500/10 border-emerald-500/25 text-emerald-400";
      case "failed":
        return "bg-red-500/10 border-red-500/25 text-red-400";
      case "cancelled":
        return "bg-gray-500/10 border-gray-500/25 text-gray-400";
      default:
        return "bg-white/[0.04] border-white/[0.08] text-gray-400";
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      case "degraded":
        return "bg-amber-500/10 border-amber-500/20 text-amber-400";
      default:
        return "bg-red-500/10 border-red-500/20 text-red-400";
    }
  };

  // Convert task name to pretty label
  const prettyTaskName = (name: string) => {
    const parts = name.split(".");
    const base = parts[parts.length - 1];
    return base
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (!isAuthenticated || !user) return null;
  if (user.platform_role !== "super_admin") return null;

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">

      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20">
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
            <Search className="w-4 h-4 text-cyan-400" />
            <span>Smart Search</span>
          </button>
        </nav>

        <div className="px-3 mt-2">
          <div className="px-3 py-2">
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Admin Panel</span>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => router.push("/dashboard/admin")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>Community Requests</span>
            </button>
            <button
              onClick={() => {}}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 transition-all font-semibold"
            >
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>Jobs Queue</span>
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
      <main className="flex-grow overflow-y-auto min-h-screen z-10">

        {/* Header */}
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Celery Asynchronous Workers Dashboard
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                Event-Driven Background Task Manager
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer bg-white/[0.03] px-3 py-2 rounded-xl border border-white/[0.08] text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-black border-white/20 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
              />
              <span>Auto-refresh (15s)</span>
            </label>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-gray-300 font-medium transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

          {/* Health & Cluster Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Worker Cluster Status</span>
                <span className={`inline-flex items-center gap-1.5 text-sm font-bold uppercase mt-2 px-2.5 py-1 rounded-lg border ${getHealthBadge(health.status)}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${health.status === "healthy" ? "bg-emerald-400" : (health.status === "degraded" ? "bg-amber-400" : "bg-red-500")}`} />
                  {health.status}
                </span>
              </div>
              <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <Cpu className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Active Worker Processes</span>
                <span className="text-2xl font-bold text-white mt-1 block">{health.workers} <span className="text-xs text-gray-500 font-normal">Nodes online</span></span>
              </div>
              <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <PlayCircle className="w-5 h-5 text-blue-400" />
              </div>
            </div>

            <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Running / Pending Tasks</span>
                <span className="text-2xl font-bold text-white mt-1 block">{health.active_jobs + health.queued_jobs} <span className="text-xs text-gray-500 font-normal">Active items</span></span>
              </div>
              <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Queued", value: stats.queued, color: "text-blue-400", border: "border-blue-500/10" },
              { label: "Running", value: stats.running, color: "text-amber-400", border: "border-amber-500/10" },
              { label: "Completed", value: stats.completed, color: "text-emerald-400", border: "border-emerald-500/10" },
              { label: "Failed", value: stats.failed, color: "text-red-400", border: "border-red-500/10" },
              { label: "Cancelled", value: stats.cancelled, color: "text-gray-400", border: "border-white/5" },
              { label: "Total Purged", value: stats.total, color: "text-white", border: "border-white/[0.06]" },
            ].map((stat) => (
              <div key={stat.label} className={`p-3 rounded-xl bg-white/[0.02] border ${stat.border} text-center`}>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">{stat.label}</span>
                <span className={`text-lg font-bold ${stat.color} mt-0.5 block`}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Job Filter & Actions Header */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white font-display">Background Tasks Registry</h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(["all", "queued", "running", "completed", "failed", "cancelled"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleFilterChange(s)}
                    className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all ${
                      filterStatus === s
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                        : "bg-white/[0.03] border-white/[0.08] text-gray-400 hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Job Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-24 gap-3">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Loading tasks queue...</span>
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl glass-panel border border-dashed border-white/[0.06]">
                <CheckCircle2 className="w-10 h-10 text-gray-600" />
                <span className="text-sm font-medium text-gray-400">
                  No {filterStatus !== "all" ? filterStatus : ""} background jobs found.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/40 backdrop-blur-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <th className="px-5 py-3">Task Name</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Progress</th>
                      <th className="px-5 py-3">Queue</th>
                      <th className="px-5 py-3">Worker</th>
                      <th className="px-5 py-3">Queued At</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="text-xs text-gray-300 hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-5 py-3.5 font-semibold text-white">
                          <div>
                            {prettyTaskName(job.task_name)}
                            <span className="block text-[9px] text-gray-500 font-mono mt-0.5 select-all">{job.id}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  job.status === "failed" ? "bg-red-400" : (job.status === "completed" ? "bg-emerald-400" : "bg-amber-400")
                                }`}
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold">{job.progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[10px] font-semibold text-gray-400 capitalize">{job.queue_name}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[10px] font-mono text-gray-400 truncate max-w-[100px] block" title={job.worker_name || "N/A"}>
                            {job.worker_name ? job.worker_name.split("@")[0] : "N/A"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 font-medium">
                          {new Date(job.queued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <span className="block text-[9px] text-gray-500 mt-0.5">
                            {new Date(job.queued_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setSelectedJob(job)}
                              className="p-1.5 rounded-lg hover:bg-white/[0.04] text-gray-400 hover:text-white transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {job.status === "failed" && (
                              <button
                                onClick={() => handleRetryJob(job.id)}
                                disabled={actionLoadingId === job.id}
                                className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
                                title="Retry Task"
                              >
                                {actionLoadingId === job.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RetryIcon className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            {(job.status === "queued" || job.status === "running") && (
                              <button
                                onClick={() => handleCancelJob(job.id)}
                                disabled={actionLoadingId === job.id}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                title="Revoke Task"
                              >
                                {actionLoadingId === job.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ====== JOB DETAIL MODAL ====== */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJob(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl glass-panel border border-white/[0.08] bg-[#0a0f1a]/95 text-left shadow-2xl z-10"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-display">
                    {prettyTaskName(selectedJob.task_name)}
                  </h3>
                  <span className="text-[10px] text-gray-500 font-mono block mt-0.5">ID: {selectedJob.id}</span>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-1 rounded-lg hover:bg-white/[0.04] text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Status</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider mt-1 ${getStatusBadge(selectedJob.status)}`}>
                      {selectedJob.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Queue Layer</span>
                    <span className="text-xs font-semibold text-gray-300 mt-1 block capitalize">{selectedJob.queue_name} queue</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-1">
                    <span>PROGRESS STATE</span>
                    <span>{selectedJob.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        selectedJob.status === "failed" ? "bg-red-400" : (selectedJob.status === "completed" ? "bg-emerald-400" : "bg-amber-400")
                      }`}
                      style={{ width: `${selectedJob.progress}%` }}
                    />
                  </div>
                  {selectedJob.progress_message && (
                    <span className="text-[10px] text-amber-400 block mt-1.5 italic font-medium">
                      &gt; {selectedJob.progress_message}
                    </span>
                  )}
                </div>

                <div className="border-t border-white/[0.04] pt-3 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block">Retries Count</span>
                    <span className="text-white font-semibold mt-0.5 block">{selectedJob.retry_count} / {selectedJob.max_retries}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block">Active Worker</span>
                    <span className="text-white font-mono mt-0.5 block truncate" title={selectedJob.worker_name}>{selectedJob.worker_name || "Unassigned"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block">Queued At</span>
                    <span className="text-white font-medium mt-0.5 block">{new Date(selectedJob.queued_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block">Last Activity</span>
                    <span className="text-white font-medium mt-0.5 block">
                      {selectedJob.completed_at
                        ? new Date(selectedJob.completed_at).toLocaleTimeString()
                        : (selectedJob.started_at ? new Date(selectedJob.started_at).toLocaleTimeString() : "Pending")}
                    </span>
                  </div>
                </div>

                {/* Input arguments */}
                {selectedJob.meta && selectedJob.meta.args && (
                  <div className="border-t border-white/[0.04] pt-3">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Input Arguments</span>
                    <pre className="mt-1 text-[10px] text-emerald-400 font-mono bg-black/40 border border-white/5 rounded-lg p-2.5 overflow-x-auto">
                      {JSON.stringify(selectedJob.meta.args, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Results JSON */}
                {selectedJob.result && (
                  <div className="border-t border-white/[0.04] pt-3">
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">Job Completion Output</span>
                    <pre className="mt-1 text-[10px] text-cyan-400 font-mono bg-black/40 border border-white/5 rounded-lg p-2.5 overflow-x-auto max-h-36">
                      {JSON.stringify(selectedJob.result, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error Traceback */}
                {selectedJob.error_message && (
                  <div className="border-t border-white/[0.04] pt-3">
                    <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider block">Error Stack Trace</span>
                    <pre className="mt-1 text-[10px] text-red-400 font-mono bg-red-500/[0.03] border border-red-500/10 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap max-h-36">
                      {selectedJob.error_message}
                    </pre>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-white/[0.06] bg-black/20 flex items-center justify-end gap-2.5">
                {(selectedJob.status === "queued" || selectedJob.status === "running") && (
                  <button
                    onClick={() => handleCancelJob(selectedJob.id)}
                    disabled={actionLoadingId === selectedJob.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {actionLoadingId === selectedJob.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    <span>Revoke Task</span>
                  </button>
                )}
                {selectedJob.status === "failed" && (
                  <button
                    onClick={() => handleRetryJob(selectedJob.id)}
                    disabled={actionLoadingId === selectedJob.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/15"
                  >
                    {actionLoadingId === selectedJob.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Retry Task</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Alert */}
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
