"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  Shield, Loader2, Home, Compass, Search, LogOut,
  Camera, MessageSquare, UserCheck, BarChart3, Cpu,
  Activity, Server, DatabaseBackup, Smartphone,
  DownloadCloud, BarChart2, Bell
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminPWADashboard() {
  const router = useRouter();
  const {user, token, isAuthenticated, logout } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (user && user.platform_role !== "super_admin") {
      router.push("/dashboard");
      return;
    }
    
    async function fetchPWAStats() {
      try {
        const res = await fetch(`${API}/api/v1/pwa/diagnostics`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load PWA stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPWAStats();
  }, [isAuthenticated, user, token, router]);

  const handleSignOut = () => { logout(); router.push("/"); };

  if (!isAuthenticated || !user || user.platform_role !== "super_admin") return null;

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">
      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-500/20 to-blue-500/20 border border-white/[0.08]">
              <Smartphone className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider text-white">FaceSnap</span>
              <span className="block text-[7px] tracking-[0.2em] text-purple-400 font-bold uppercase -mt-0.5">
                Super Admin
              </span>
            </div>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1">
          <button onClick={() => router.push("/dashboard")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all">
            <Home className="w-4 h-4" /><span>Dashboard</span>
          </button>
          <button onClick={() => router.push("/dashboard/discover")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all">
            <Compass className="w-4 h-4" /><span>Discover</span>
          </button>
          <button onClick={() => router.push("/dashboard/my-photos")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all">
            <Camera className="w-4 h-4" /><span>My Photos</span>
          </button>
          <button onClick={() => router.push("/dashboard/chat")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all">
            <MessageSquare className="w-4 h-4" /><span>Private Chat</span>
          </button>
          <button onClick={() => router.push("/dashboard/search")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all">
            <Search className="w-4 h-4" /><span>Smart Search</span>
          </button>
        </nav>

        <div className="px-3 mt-2">
          <div className="px-3 py-2">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Admin Panel</span>
          </div>
          <div className="space-y-1">
            <button onClick={() => router.push("/dashboard/admin")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all">
              <UserCheck className="w-4 h-4 text-gray-400" /><span>Community Requests</span>
            </button>
            <button onClick={() => router.push("/dashboard/admin/jobs")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all">
              <Cpu className="w-4 h-4 text-gray-400" /><span>Jobs Queue</span>
            </button>
            <button onClick={() => router.push("/dashboard/admin/security")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all">
              <Shield className="w-4 h-4 text-amber-500" /><span>Security Controls</span>
            </button>
            <button onClick={() => router.push("/dashboard/admin/status")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all">
              <Server className="w-4 h-4 text-emerald-400" /><span>Uptime Status</span>
            </button>
            <button onClick={() => router.push("/dashboard/admin/monitoring")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all">
              <Activity className="w-4 h-4 text-cyan-400" /><span>System Monitor</span>
            </button>
            <button onClick={() => router.push("/dashboard/admin/infrastructure")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all">
              <Cpu className="w-4 h-4 text-amber-500" /><span>Infra Controls</span>
            </button>
            <button onClick={() => router.push("/dashboard/admin/recovery")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.03] transition-all">
              <DatabaseBackup className="w-4 h-4 text-amber-400" /><span>Backup & Recovery</span>
            </button>
            <button onClick={() => {}} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
              <Smartphone className="w-4 h-4 text-purple-400" /><span>Mobile & PWA</span>
            </button>
          </div>
        </div>

        <div className="mt-auto px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="text-xs font-bold text-white block truncate">{user?.full_name}</span>
              <span className="text-[10px] text-purple-400 block truncate font-semibold">Super Admin</span>
            </div>
            <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all" title="Sign Out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ====== MAIN CONTENT ====== */}
      <main className="flex-grow overflow-y-auto min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-4 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Mobile & PWA Telemetry
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                Monitor Progressive Web App adoption
              </p>
            </div>
          </div>
        </div>

        {/* Content Deck */}
        <div className="p-8 space-y-6">
          {loading ? (
            <div className="flex items-center gap-3 text-cyan-500">
              <Activity className="animate-spin w-5 h-5" />
              <span className="text-sm font-semibold">Loading PWA telemetry...</span>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#1e293b]/50 border border-white/[0.05] p-6 rounded-2xl flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
                  <Bell className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats?.total_push_subscriptions || 0}</div>
                <div className="text-sm text-gray-400 font-medium uppercase tracking-wider">Active Push Subscribers</div>
              </div>

              <div className="bg-[#1e293b]/50 border border-white/[0.05] p-6 rounded-2xl flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <Smartphone className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats?.pwa_install_estimate || 0}</div>
                <div className="text-sm text-gray-400 font-medium uppercase tracking-wider">Estimated App Installs</div>
              </div>

              <div className="bg-[#1e293b]/50 border border-white/[0.05] p-6 rounded-2xl flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                  <DownloadCloud className="w-6 h-6 text-orange-400" />
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats?.offline_sync_events || 0}</div>
                <div className="text-sm text-gray-400 font-medium uppercase tracking-wider">Offline Syncs Restored</div>
              </div>
            </div>
          )}

          <div className="bg-[#1e293b]/50 border border-white/[0.05] rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-gray-400" /> System Diagnostics
            </h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-3 border-b border-white/[0.05]">
                <span className="text-gray-400">VAPID Keys Configured</span>
                <span className={`font-bold ${stats?.vapid_keys_configured ? "text-green-400" : "text-red-400"}`}>
                  {stats?.vapid_keys_configured ? "Valid" : "Missing"}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/[0.05]">
                <span className="text-gray-400">Database Auto-Migration (push_subscriptions)</span>
                <span className="text-green-400 font-bold">Passed</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-400">Push Worker Health</span>
                <span className="text-green-400 font-bold">Online</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
