"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { 
  Users, Layers, Calendar, Image as ImageIcon, MessageSquare, 
  AlertTriangle, CheckCircle, Activity, Server, Clock, ShieldAlert, Zap
} from "lucide-react";

export default function AdminOperationsDashboard() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/admin/operations/stats", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          setStats(await res.json());
          setLastRefresh(new Date());
        }
      } catch (err) {
        console.error("Failed to fetch operations stats", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // 30 sec live refresh
    return () => clearInterval(interval);
  }, [token]);

  const MetricCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-[#1e293b]/50 border border-white/[0.05] p-6 rounded-2xl flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colorClass.bg} border ${colorClass.border}`}>
          <Icon className={`w-5 h-5 ${colorClass.text}`} />
        </div>
      </div>
      <div>
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-1">{title}</p>
        {subtitle && <p className="text-[10px] text-gray-500 mt-2 font-medium">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto min-h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Global Operations Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Live Platform Telemetry 
                {loading ? <Zap className="w-3 h-3 text-cyan-400 animate-pulse" /> : <CheckCircle className="w-3 h-3 text-emerald-400" />}
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            Last Updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>

        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-400" /> Platform Metrics
            </h2>
            {stats?.system?.health === "healthy" ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" /> SYSTEM OPERATIONAL
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5" /> DEGRADED PERFORMANCE
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard 
              title="Total Users" 
              value={stats?.users?.total || 0} 
              subtitle={`${stats?.users?.dau || 0} active today`}
              icon={Users} 
              colorClass={{ bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' }} 
            />
            <MetricCard 
              title="Communities" 
              value={stats?.content?.communities || 0} 
              icon={Layers} 
              colorClass={{ bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' }} 
            />
            <MetricCard 
              title="Events" 
              value={stats?.content?.events || 0} 
              icon={Calendar} 
              colorClass={{ bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400' }} 
            />
            <MetricCard 
              title="Total Photos" 
              value={stats?.content?.photos || 0} 
              icon={ImageIcon} 
              colorClass={{ bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' }} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1e293b]/30 border border-white/[0.05] p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-400" /> Active Engagement
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                  <span className="text-gray-400">Daily Active Users (DAU)</span>
                  <span className="font-bold text-white">{stats?.users?.dau || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                  <span className="text-gray-400">Weekly Active Users (WAU)</span>
                  <span className="font-bold text-white">{stats?.users?.wau || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                  <span className="text-gray-400">Monthly Active Users (MAU)</span>
                  <span className="font-bold text-white">{stats?.users?.mau || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400">Total Messages Sent</span>
                  <span className="font-bold text-white">{stats?.content?.messages || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1e293b]/30 border border-white/[0.05] p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-gray-400" /> System Health Diagnostics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                  <span className="text-gray-400">Active Incidents</span>
                  <span className={`font-bold ${stats?.system?.open_incidents > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {stats?.system?.open_incidents || 0} Open
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                  <span className="text-gray-400">Failed Background Jobs</span>
                  <span className={`font-bold ${stats?.system?.failed_jobs > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                    {stats?.system?.failed_jobs || 0} Failed
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                  <span className="text-gray-400">Platform Status</span>
                  <span className="font-bold text-emerald-400 capitalize">{stats?.system?.health || "Operational"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
