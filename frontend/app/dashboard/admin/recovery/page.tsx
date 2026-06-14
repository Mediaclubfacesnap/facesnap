"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Loader2, Home, Compass, Search, LogOut, RefreshCw,
  Database, Server, CheckCircle2, AlertTriangle, XCircle, Clock,
  DatabaseBackup, Zap, Mail, BarChart3, Globe,
  UserCheck, Download, Trash2, ShieldAlert, Cpu, Eye, ArrowUpRight, Camera, MessageSquare, Play, HelpCircle, Smartphone
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RecoveryStatus {
  health_score: number;
  health_category: string;
  backup_success_rate: number;
  restore_success_rate: number;
  last_backup_time: string | null;
  last_success_backup: string | null;
  hours_since_last_backup: number | null;
  storage: {
    primary_bytes: number;
    secondary_bytes: number;
    archive_bytes: number;
    total_bytes: number;
    growth_per_day_bytes: number;
    forecast_30d_bytes: number;
    forecast_90d_bytes: number;
    forecast_180d_bytes: number;
  };
  disaster_simulation: {
    last_recovery_time_sec: number;
    active_simulation: boolean;
  };
}

interface BackupRecord {
  id: string;
  backup_type: string;
  backup_size: number;
  backup_location: string;
  created_at: string;
  verified: boolean;
  restore_tested: boolean;
  status: "success" | "failed" | "testing" | "restored";
  checksum?: string;
  encryption_version: string;
  restore_duration?: number;
  meta: Record<string, any>;
}

type RunbookKey = "database" | "redis" | "worker" | "storage";

export default function AdminRecoveryPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [activeRunbook, setActiveRunbook] = useState<RunbookKey>("database");

  // Detail Modal
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 10;

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
  }, [isAuthenticated, user, offset]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resStatus, resBackups] = await Promise.all([
        fetch(`${API}/api/v1/recovery/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/recovery/backups?limit=${limit}&offset=${offset}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (resStatus.ok) {
        setStatus(await resStatus.json());
      }
      if (resBackups.ok) {
        setBackups(await resBackups.json());
      }
    } catch (err) {
      console.error("Failed to fetch recovery data:", err);
      showToast("Could not communicate with recovery telemetry servers.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const triggerBackup = async (type: string) => {
    setActionLoading("backup");
    try {
      const res = await fetch(`${API}/api/v1/recovery/backup?backup_type=${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Backup task successfully queued in Celery worker cluster.", "success");
        setTimeout(fetchData, 3000);
      } else {
        throw new Error(data.detail || "Failed to trigger backup.");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const triggerRestoreTest = async (backupId: string) => {
    setActionLoading(`restore-${backupId}`);
    try {
      const res = await fetch(`${API}/api/v1/recovery/test-restore?backup_id=${backupId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Restore verification sequence started in sandbox schema.", "success");
        setTimeout(fetchData, 4000);
      } else {
        throw new Error(data.detail || "Failed to start restore test.");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const runDisasterSimulation = async (type: string) => {
    setActionLoading(`sim-${type}`);
    try {
      const res = await fetch(`${API}/api/v1/recovery/disaster-simulation?failure_type=${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Disaster simulation for '${type.toUpperCase()}' completed. Recovery successful in ${data.recovery_duration_sec}s.`, "success");
        setTimeout(fetchData, 1000);
      } else {
        throw new Error(data.detail || "Failed to run simulation.");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportCSV = () => {
    window.open(`${API}/api/v1/recovery/export?token=${token}`, "_blank");
    showToast("Downloading backup logs CSV report...", "success");
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-cyan-400";
    if (score >= 50) return "text-amber-400";
    return "text-rose-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-bold">SUCCESS</span>;
      case "failed":
        return <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/25 text-[10px] font-bold">FAILED</span>;
      case "testing":
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[10px] font-bold animate-pulse">TESTING</span>;
      case "restored":
        return <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/25 text-[10px] font-bold">RESTORED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/25 text-[10px] font-bold">{status.toUpperCase()}</span>;
    }
  };

  if (!isAuthenticated || !user) return null;
  if (user.platform_role !== "super_admin") return null;

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl ${
              toast.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-300"
                : "bg-red-950/80 border-red-500/30 text-red-300"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
            <span className="text-xs font-semibold">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500/20 to-red-500/20 border border-white/[0.08]">
              <DatabaseBackup className="w-4 h-4 text-amber-400" />
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/discover")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all"
          >
            <Compass className="w-4 h-4" />
            <span>Discover</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/my-photos")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all"
          >
            <Camera className="w-4 h-4" />
            <span>My Photos</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/chat")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Private Chat</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/search")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all"
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
              <UserCheck className="w-4 h-4 text-gray-400" />
              <span>Community Requests</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/jobs")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Cpu className="w-4 h-4 text-gray-400" />
              <span>Jobs Queue</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/security")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Shield className="w-4 h-4 text-amber-500" />
              <span>Security Controls</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/status")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Server className="w-4 h-4 text-emerald-400" />
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
              onClick={() => {}}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
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
      <main className="flex-grow overflow-y-auto min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-4 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <DatabaseBackup className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Backup & Disaster Recovery Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                Enterprise Business Continuity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 rounded-xl border border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04] text-xs font-bold text-gray-300 transition-all flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl border border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300 hover:text-white transition-all"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Content Deck */}
        <div className="p-8 space-y-6">
          {isLoading && !status ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                <span className="text-xs text-gray-400 font-semibold">Resolving disaster recovery metrics...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Telemetry Stats Deck */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Health Score Gauge */}
                <div className="glass-panel border border-white/[0.06] rounded-2xl p-5 bg-[#0a0f1a]/50 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full filter blur-xl" />
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Recovery Health Score</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={`text-4xl font-extrabold tracking-tight ${getHealthColor(status?.health_score || 0)}`}>
                        {status?.health_score}
                      </span>
                      <span className="text-xs font-bold text-gray-400">/100</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="font-semibold">Category:</span>
                    <span className={`font-extrabold ${getHealthColor(status?.health_score || 0)}`}>{status?.health_category}</span>
                  </div>
                </div>

                {/* Backup Success Rate */}
                <div className="glass-panel border border-white/[0.06] rounded-2xl p-5 bg-[#0a0f1a]/50 flex flex-col justify-between">
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Backup Success Rate</span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight text-white">{status?.backup_success_rate}%</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Calculated over total logs</span>
                  </div>
                </div>

                {/* Restore Verification */}
                <div className="glass-panel border border-white/[0.06] rounded-2xl p-5 bg-[#0a0f1a]/50 flex flex-col justify-between">
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Restore Test Success</span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight text-white">{status?.restore_success_rate}%</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Verified in Sandbox Schema</span>
                  </div>
                </div>

                {/* Capacity Usage */}
                <div className="glass-panel border border-white/[0.06] rounded-2xl p-5 bg-[#0a0f1a]/50 flex flex-col justify-between">
                  <div>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Storage Capacity</span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-extrabold tracking-tight text-white">
                        {status ? formatBytes(status.storage.total_bytes) : "0 MB"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                    <span>P: {status ? formatBytes(status.storage.primary_bytes, 0) : "0"}</span>
                    <span>S: {status ? formatBytes(status.storage.secondary_bytes, 0) : "0"}</span>
                    <span>A: {status ? formatBytes(status.storage.archive_bytes, 0) : "0"}</span>
                  </div>
                </div>
              </div>

              {/* Action Controls & Forecasting */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Control Deck */}
                <div className="glass-panel border border-white/[0.06] rounded-2xl p-6 bg-[#0a0f1a]/50 space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recovery Control Panel</h2>
                  
                  <div className="space-y-3">
                    {/* Manual Backup Trigger */}
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Compile New Backup</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => triggerBackup("manual")}
                          disabled={actionLoading !== null}
                          className="flex-grow py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
                        >
                          {actionLoading === "backup" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                          <span>Create Full Backup</span>
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-white/[0.06] my-4" />

                    {/* Disaster Simulation */}
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Failover Sandbox Simulation</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(["database", "redis", "worker", "storage"] as const).map((simType) => (
                          <button
                            key={simType}
                            onClick={() => runDisasterSimulation(simType)}
                            disabled={actionLoading !== null}
                            className="py-2 px-3 rounded-xl border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30 text-red-400 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {actionLoading === `sim-${simType}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            <span className="capitalize">{simType} Sim</span>
                          </button>
                        ))}
                      </div>
                      <span className="block text-[9px] text-gray-500 mt-1.5 italic">
                        * Runs real recovery code inside test namespaces. Last recovery time: {status?.disaster_simulation.last_recovery_time_sec}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Storage Forecasting */}
                <div className="glass-panel border border-white/[0.06] rounded-2xl p-6 bg-[#0a0f1a]/50 lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Capacity Growth Forecasting</h2>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">Linear regression model</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] flex flex-col justify-between">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Expected Size in 30 Days</span>
                      <span className="text-lg font-bold text-white mt-1">
                        {status ? formatBytes(status.storage.forecast_30d_bytes) : "0 MB"}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-2 font-mono">
                        +{status ? formatBytes(status.storage.growth_per_day_bytes * 30, 0) : "0"} expected
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] flex flex-col justify-between">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Expected Size in 90 Days</span>
                      <span className="text-lg font-bold text-white mt-1">
                        {status ? formatBytes(status.storage.forecast_90d_bytes) : "0 MB"}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-2 font-mono">
                        +{status ? formatBytes(status.storage.growth_per_day_bytes * 90, 0) : "0"} expected
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] flex flex-col justify-between">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Expected Size in 180 Days</span>
                      <span className="text-lg font-bold text-white mt-1">
                        {status ? formatBytes(status.storage.forecast_180d_bytes) : "0 MB"}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-2 font-mono">
                        +{status ? formatBytes(status.storage.growth_per_day_bytes * 180, 0) : "0"} expected
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-300 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Automated Retention Alert:</span> Daily backups are automatically cleaned up after 30 days, keeping the total staging footprint stable and protecting the database storage quotas.
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Runbooks */}
              <div className="glass-panel border border-white/[0.06] rounded-2xl bg-[#0a0f1a]/50 overflow-hidden">
                <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">Disaster Recovery Runbooks</h2>
                  <div className="flex gap-1 border border-white/[0.08] p-0.5 rounded-lg bg-black/40">
                    {(["database", "redis", "worker", "storage"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveRunbook(tab)}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                          activeRunbook === tab
                            ? "bg-amber-500 text-black shadow-lg"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  {activeRunbook === "database" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold">SEVERITY: CRITICAL</span>
                        <span className="text-xs text-gray-400 font-semibold font-mono">Target RTO: &lt;30 Minutes | Target RPO: &lt;24 Hours</span>
                      </div>
                      <div className="text-xs text-gray-300 space-y-2">
                        <p className="font-semibold text-white">Scenario: PostgreSQL Database Outage, Corruption, or Accidental Deletion</p>
                        <p>1. Identify the container state inside Nginx or docker:</p>
                        <pre className="p-3 bg-black/60 rounded-xl text-amber-400 font-mono text-[10px] overflow-x-auto">
                          docker compose ps postgres
                        </pre>
                        <p>2. To restore the latest verified DB dump encrypted tarball from the primary folder:</p>
                        <pre className="p-3 bg-black/60 rounded-xl text-amber-400 font-mono text-[10px] overflow-x-auto">
                          # Decrypt and restore via API triggers or manually via db_backup.sh script
                        </pre>
                      </div>
                    </div>
                  )}

                  {activeRunbook === "redis" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold">SEVERITY: MAJOR</span>
                        <span className="text-xs text-gray-400 font-semibold font-mono">Target RTO: &lt;60 Minutes | Target RPO: &lt;1 Hour</span>
                      </div>
                      <div className="text-xs text-gray-300 space-y-2">
                        <p className="font-semibold text-white">Scenario: Redis Out-of-Memory or Cache Disconnect</p>
                        <p>1. Clear memory bloat or force restart cache container:</p>
                        <pre className="p-3 bg-black/60 rounded-xl text-amber-400 font-mono text-[10px] overflow-x-auto">
                          docker compose restart redis
                        </pre>
                        <p>2. Execute the Redis Cache Rebuild task to automatically rebuild online statuses and active communities counters:</p>
                        <pre className="p-3 bg-black/60 rounded-xl text-amber-400 font-mono text-[10px] overflow-x-auto">
                          # Click the "Rebuild Redis Status" button on the dashboard or trigger /disaster-simulation?failure_type=redis
                        </pre>
                      </div>
                    </div>
                  )}

                  {activeRunbook === "worker" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold">SEVERITY: MAJOR</span>
                        <span className="text-xs text-gray-400 font-semibold font-mono">Target RTO: &lt;60 Minutes</span>
                      </div>
                      <div className="text-xs text-gray-300 space-y-2">
                        <p className="font-semibold text-white">Scenario: Celery Workers Offline or Hangs during Heavy facial vector scans</p>
                        <p>1. Check online celery nodes:</p>
                        <pre className="p-3 bg-black/60 rounded-xl text-amber-400 font-mono text-[10px] overflow-x-auto">
                          docker compose exec celery-worker celery -A app.workers.celery_app inspect ping
                        </pre>
                        <p>2. Reboot workers pool:</p>
                        <pre className="p-3 bg-black/60 rounded-xl text-amber-400 font-mono text-[10px] overflow-x-auto">
                          docker compose restart celery-worker celery-beat
                        </pre>
                      </div>
                    </div>
                  )}

                  {activeRunbook === "storage" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-300 border border-white/[0.08] text-[9px] font-bold">SEVERITY: MODERATE</span>
                        <span className="text-xs text-gray-400 font-semibold font-mono">Target RTO: &lt;4 Hours</span>
                      </div>
                      <div className="text-xs text-gray-300 space-y-2">
                        <p className="font-semibold text-white">Scenario: Storage corruption or local folder directory quota exhaustion</p>
                        <p>1. Perform Docker systems prune to clean building caches:</p>
                        <pre className="p-3 bg-black/60 rounded-xl text-amber-400 font-mono text-[10px] overflow-x-auto">
                          docker system prune -a --volumes -f
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* History Table */}
              <div className="glass-panel border border-white/[0.06] rounded-2xl bg-[#0a0f1a]/50 overflow-hidden">
                <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">Backup logs & History</h2>
                  <span className="text-[10px] text-gray-400 font-semibold">Showing latest backup logs</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.04] bg-white/[0.01] text-gray-400 font-bold">
                        <th className="px-6 py-3.5">Backup Type</th>
                        <th className="px-6 py-3.5">Created At</th>
                        <th className="px-6 py-3.5">File Size</th>
                        <th className="px-6 py-3.5">Location</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5">Encryption</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                            No backup records available. Trigger a manual backup above to create one.
                          </td>
                        </tr>
                      ) : (
                        backups.map((b) => (
                          <tr
                            key={b.id}
                            className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-all"
                          >
                            <td className="px-6 py-4 font-bold capitalize text-amber-400">{b.backup_type}</td>
                            <td className="px-6 py-4 text-gray-300">
                              {new Date(b.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-mono text-gray-300">
                              {formatBytes(b.backup_size)}
                            </td>
                            <td className="px-6 py-4 text-gray-400 max-w-[120px] truncate" title={b.backup_location}>
                              {b.backup_location}
                            </td>
                            <td className="px-6 py-4">{getStatusBadge(b.status)}</td>
                            <td className="px-6 py-4 text-[10px] font-mono text-gray-400">
                              {b.encryption_version}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => triggerRestoreTest(b.id)}
                                disabled={actionLoading !== null}
                                className="px-2.5 py-1 rounded-lg border border-amber-500/20 hover:bg-amber-500/10 text-amber-400 text-[10px] font-bold transition-all disabled:opacity-50"
                              >
                                {actionLoading === `restore-${b.id}` ? "TESTING..." : "TEST RESTORE"}
                              </button>
                              <button
                                onClick={() => setSelectedBackup(b)}
                                className="p-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-gray-300 hover:text-white transition-all inline-flex items-center justify-center align-middle"
                                title="Inspect Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-gray-400">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 rounded-xl border border-white/[0.06] hover:bg-white/[0.02] transition-all disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <span className="font-mono">Page {Math.floor(offset / limit) + 1}</span>
                  <button
                    onClick={() => setOffset(offset + limit)}
                    disabled={backups.length < limit}
                    className="px-3 py-1.5 rounded-xl border border-white/[0.06] hover:bg-white/[0.02] transition-all disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedBackup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl glass-panel border border-white/[0.08] bg-[#0a0f1a]/95 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Inspect Backup Metadata</h3>
                <button
                  onClick={() => setSelectedBackup(null)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-mono">
                <div>
                  <span className="text-gray-500 block uppercase text-[10px]">Backup ID</span>
                  <span className="text-gray-200">{selectedBackup.id}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500 block uppercase text-[10px]">Type</span>
                    <span className="text-amber-400 capitalize font-bold">{selectedBackup.backup_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block uppercase text-[10px]">Status</span>
                    <span>{selectedBackup.status.toUpperCase()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500 block uppercase text-[10px]">Size</span>
                    <span className="text-gray-200">{formatBytes(selectedBackup.backup_size)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block uppercase text-[10px]">Created At</span>
                    <span className="text-gray-200">{new Date(selectedBackup.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <span className="text-gray-500 block uppercase text-[10px]">Checksum (SHA-256)</span>
                  <span className="text-gray-300 break-all select-all">{selectedBackup.checksum || "N/A"}</span>
                </div>

                <div>
                  <span className="text-gray-500 block uppercase text-[10px]">Encryption Details</span>
                  <span className="text-gray-300">{selectedBackup.encryption_version}</span>
                </div>

                {selectedBackup.restore_duration && (
                  <div>
                    <span className="text-gray-500 block uppercase text-[10px]">Last Restore Test Duration</span>
                    <span className="text-gray-300">{selectedBackup.restore_duration.toFixed(2)} seconds</span>
                  </div>
                )}

                <div>
                  <span className="text-gray-500 block uppercase text-[10px]">Tables & Metadata (Meta JSON)</span>
                  <pre className="p-3 bg-black/60 rounded-xl text-emerald-400 overflow-y-auto max-h-[150px] text-[10px]">
                    {JSON.stringify(selectedBackup.meta, null, 2)}
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
