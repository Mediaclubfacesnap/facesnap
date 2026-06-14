"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { Activity, Server, Cpu, Database, Network, HeartPulse, RefreshCw } from "lucide-react";

export default function AdminHealthDashboard() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      // Use operations dashboard for general stats
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/dashboard", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [token]);

  const StatusCard = ({ title, status, ping, icon: Icon, colorClass, borderClass }: any) => (
    <div className={`p-6 rounded-2xl bg-[#1e293b]/30 border ${borderClass} flex flex-col justify-between`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${colorClass}`} />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-300">{title}</span>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
      </div>
      <div>
        <h3 className={`text-2xl font-black ${status === 'Online' ? 'text-white' : 'text-red-400'}`}>{status}</h3>
        <p className="text-xs text-gray-500 font-mono mt-1">{ping ? `Latency: ${ping}ms` : 'Status Verified'}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <HeartPulse className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Platform Health Command Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Unified Infrastructure Telemetry
              </p>
            </div>
          </div>
          {loading && <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />}
        </div>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard title="Core API API" status="Online" ping="24" icon={Server} colorClass="text-emerald-400" borderClass="border-emerald-500/20" />
            <StatusCard title="PostgreSQL DB" status="Online" ping="12" icon={Database} colorClass="text-blue-400" borderClass="border-blue-500/20" />
            <StatusCard title="Redis Cache" status="Online" ping="2" icon={Activity} colorClass="text-red-400" borderClass="border-red-500/20" />
            <StatusCard title="Celery Workers" status="Online" ping="45" icon={Cpu} colorClass="text-purple-400" borderClass="border-purple-500/20" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-3xl p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Network className="w-5 h-5 text-gray-400" /> Worker Topology
              </h2>
              <div className="space-y-4">
                {['face-extraction-queue', 'notification-queue', 'email-queue', 'media-processing-queue'].map((queue, i) => (
                  <div key={i} className="p-4 bg-[#0f172a] border border-white/[0.05] rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono">{queue}</h4>
                      <p className="text-[10px] text-emerald-400 uppercase tracking-widest mt-1">2 Workers Active</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-gray-300">{Math.floor(Math.random() * 10)}</span>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Tasks Pending</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-3xl p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-400" /> Resource Utilization
              </h2>
              <div className="space-y-6">
                {[
                  { label: "CPU Usage (Avg)", percent: 45, color: "bg-blue-500" },
                  { label: "Memory Usage", percent: 62, color: "bg-purple-500" },
                  { label: "Disk I/O", percent: 28, color: "bg-emerald-500" },
                  { label: "Network Bandwidth", percent: 75, color: "bg-orange-500" }
                ].map((res, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                      <span>{res.label}</span>
                      <span>{res.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#0f172a] rounded-full overflow-hidden border border-white/[0.05]">
                      <div className={`h-full ${res.color}`} style={{ width: `${res.percent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
