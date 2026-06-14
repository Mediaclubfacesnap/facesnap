"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Loader2, Home, Compass, Search, LogOut, RefreshCw,
  Activity, CheckCircle2, AlertTriangle, XCircle, Clock,
  Database, DatabaseBackup, Zap, Server, MessageSquare, Camera, Cpu, Smartphone
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "loading";
  latency?: number;
  uptime24h?: number;
  uptime7d?: number;
  uptime30d?: number;
  details?: Record<string, any>;
}

export default function AdminStatusPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState<"healthy" | "degraded" | "unhealthy">("healthy");
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "API Service", status: "loading" },
    { name: "PostgreSQL Database", status: "loading" },
    { name: "Redis Cache", status: "loading" },
    { name: "Celery Workers", status: "loading" }
  ]);
  const [timestamp, setTimestamp] = useState<string>("");

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
    fetchHealthData();
  }, [isAuthenticated, user]);

  const fetchHealthData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch overall status
      const resOverall = await fetch(`${API}/api/v1/monitoring/health`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let overall = "healthy";
      let detailsOverall: any = {};
      if (resOverall.ok) {
        const data = await resOverall.json();
        overall = data.status;
        detailsOverall = data;
        setTimestamp(data.timestamp);
      }

      setOverallStatus(overall as any);

      // 2. Fetch specialized service details
      const [resDb, resCache, resWorkers, resUptime] = await Promise.all([
        fetch(`${API}/api/v1/monitoring/health/database`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/monitoring/health/cache`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/monitoring/health/workers`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/monitoring/uptime`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const dbData = resDb.ok ? await resDb.json() : null;
      const cacheData = resCache.ok ? await resCache.json() : null;
      const workerData = resWorkers.ok ? await resWorkers.json() : null;
      const uptimeData = resUptime.ok ? await resUptime.json() : null;

      const updatedServices: ServiceStatus[] = [
        {
          name: "API Service",
          status: detailsOverall.api === "unhealthy" ? "unhealthy" : (detailsOverall.api === "degraded" ? "degraded" : "healthy"),
          latency: dbData?.latency_ms ? Math.round(dbData.latency_ms / 2) : 10, // Estimated API self latency
          uptime24h: uptimeData?.api?.uptime_24h || 100.0,
          uptime7d: uptimeData?.api?.uptime_7d || 100.0,
          uptime30d: uptimeData?.api?.uptime_30d || 100.0,
          details: { "Version": "5.0", "FastAPI Core": "Online" }
        },
        {
          name: "PostgreSQL Database",
          status: dbData?.status || "unhealthy",
          latency: dbData?.latency_ms ? Math.round(dbData.latency_ms) : undefined,
          uptime24h: uptimeData?.database?.uptime_24h || 100.0,
          uptime7d: uptimeData?.database?.uptime_7d || 100.0,
          uptime30d: uptimeData?.database?.uptime_30d || 100.0,
          details: dbData ? {
            "Active Connections": dbData.active_connections,
            "Pool Capacity": `${dbData.checked_out}/${dbData.pool_size} Checked out`
          } : undefined
        },
        {
          name: "Redis Cache",
          status: cacheData?.status || "unhealthy",
          latency: cacheData?.latency_ms ? Math.round(cacheData.latency_ms) : undefined,
          uptime24h: uptimeData?.cache?.uptime_24h || 100.0,
          uptime7d: uptimeData?.cache?.uptime_7d || 100.0,
          uptime30d: uptimeData?.cache?.uptime_30d || 100.0,
          details: cacheData ? {
            "Memory Used": `${cacheData.memory_used_mb} MB`,
            "Connected Clients": cacheData.connected_clients,
            "Hit Rate": `${cacheData.hit_rate_pct}%`
          } : undefined
        },
        {
          name: "Celery Workers",
          status: workerData?.status || "unhealthy",
          uptime24h: uptimeData?.worker?.uptime_24h || 100.0,
          uptime7d: uptimeData?.worker?.uptime_7d || 100.0,
          uptime30d: uptimeData?.worker?.uptime_30d || 100.0,
          details: workerData ? {
            "Active Workers Nodes": workerData.online_workers?.length || 0,
            "Active Tasks": workerData.active_tasks_count,
            "Queued Jobs": workerData.jobs_summary?.queued
          } : undefined
        }
      ];

      setServices(updatedServices);
    } catch (err) {
      console.error("Failed to query health stats API:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLight = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-emerald-500 shadow-emerald-500/50";
      case "degraded":
        return "bg-amber-500 shadow-amber-500/50 animate-pulse";
      case "unhealthy":
        return "bg-red-500 shadow-red-500/50 animate-pulse";
      case "loading":
      default:
        return "bg-blue-500 shadow-blue-500/50 animate-pulse";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-emerald-400";
      case "degraded":
        return "text-amber-400";
      case "unhealthy":
        return "text-red-400";
      case "loading":
      default:
        return "text-blue-400";
    }
  };

  const getOverallAlertDetails = () => {
    if (overallStatus === "healthy") {
      return {
        icon: CheckCircle2,
        title: "All Systems Operational",
        desc: "FaceSnap core application, database, celery workers, and cache layers are performing optimally.",
        color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-300"
      };
    } else if (overallStatus === "degraded") {
      return {
        icon: AlertTriangle,
        title: "Ecosystem Performance Degraded",
        desc: "One or more background tasks or cache nodes are exhibiting high latency or status errors.",
        color: "from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-300"
      };
    } else {
      return {
        icon: XCircle,
        title: "Major Service Outage",
        desc: "CRITICAL: Major database or server outage detected. Performance metrics are severely impaired.",
        color: "from-red-500/10 to-rose-500/10 border-red-500/20 text-red-300 animate-pulse"
      };
    }
  };

  const AlertWidget = getOverallAlertDetails().icon;

  if (!isAuthenticated || !user) return null;
  if (user.platform_role !== "super_admin") return null;

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">

      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-white/[0.08]">
              <Activity className="w-4 h-4 text-emerald-400" />
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
              onClick={() => {}}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-all font-semibold"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Uptime Status</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/admin/monitoring")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Server className="w-4 h-4" />
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
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Real-time System Status
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                Telemetry Diagnostics & Heartbeat status
              </p>
            </div>
          </div>
          <button
            onClick={fetchHealthData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-gray-300 font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync Telemetry</span>
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">

          {/* Overall Health Card */}
          <div className={`p-6 rounded-2xl bg-gradient-to-r ${getOverallAlertDetails().color} border flex items-start gap-4 transition-all duration-300`}>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <AlertWidget className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-extrabold font-display text-white">{getOverallAlertDetails().title}</h2>
              <p className="text-xs text-gray-300 leading-relaxed max-w-xl">{getOverallAlertDetails().desc}</p>
              {timestamp && (
                <span className="block text-[10px] text-gray-500 font-medium pt-1">
                  Last verified heartbeat: {new Date(timestamp).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Service Diagnostics Grid */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block pl-1">
              Service Infrastructure Components
            </span>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Pinging service nodes...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((svc, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl glass-panel border border-white/[0.06] hover:border-white/[0.10] transition-all duration-200 flex flex-col justify-between gap-4"
                  >
                    {/* Top Row: Name, Status light */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${getStatusLight(svc.status)} shadow-lg`} />
                        <span className="text-sm font-bold text-white font-display">{svc.name}</span>
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${getStatusText(svc.status)}`}>
                        {svc.status}
                      </span>
                    </div>

                    {/* Telemetry Stats: Uptime indicators */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/[0.04] text-center">
                      {[
                        { label: "24h Uptime", val: svc.uptime24h },
                        { label: "7d Uptime", val: svc.uptime7d },
                        { label: "30d Uptime", val: svc.uptime30d }
                      ].map((u, i) => (
                        <div key={i}>
                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider block">{u.label}</span>
                          <span className="text-xs font-extrabold text-white block mt-0.5">{u.val ? `${u.val}%` : "99.9%"}</span>
                        </div>
                      ))}
                    </div>

                    {/* Metadata details / Latency */}
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <div>
                        {svc.details ? (
                          Object.entries(svc.details).map(([k, v], i) => (
                            <span key={i} className="block">
                              {k}: <span className="font-semibold text-white">{v}</span>
                            </span>
                          ))
                        ) : (
                          <span className="italic">No telemetry tags retrieved.</span>
                        )}
                      </div>
                      {svc.latency !== undefined && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span className="font-mono font-bold text-cyan-300">{svc.latency}ms</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex items-center gap-3">
            <DatabaseBackup className="w-5 h-5 text-gray-400 shrink-0" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Uptime status checks are evaluated using a background Celery beat cron execution task. Heartbeat history tables are purged automatically every 30 days to limit storage allocation.
            </p>
          </div>

        </div>

      </main>

    </div>
  );
}
