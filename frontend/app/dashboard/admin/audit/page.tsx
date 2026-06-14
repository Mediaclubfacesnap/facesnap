"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { Activity, Search, Filter, Shield, Settings, Server, Users } from "lucide-react";

export default function AdminAuditDashboard() {
  const { token } = useAuthStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchLogs = async () => {
    try {
      // Reusing the operations dashboard endpoint that returns system stats including audit logs
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/dashboard", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.recent_audits || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const getIcon = (action: string) => {
    if (action.includes("USER")) return <Users className="w-4 h-4 text-blue-400" />;
    if (action.includes("FEATURE")) return <Settings className="w-4 h-4 text-purple-400" />;
    if (action.includes("SYSTEM")) return <Server className="w-4 h-4 text-orange-400" />;
    return <Shield className="w-4 h-4 text-gray-400" />;
  };

  const filteredLogs = logs.filter(log => filter === "all" || log.action.includes(filter));

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Audit Replay Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Immutable Operations Ledger
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Quick Filters */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
            {[
              { id: "all", label: "All Actions" },
              { id: "USER", label: "User Management" },
              { id: "COMMUNITY", label: "Community Ops" },
              { id: "FEATURE", label: "Feature Flags" },
              { id: "MAINTENANCE", label: "Maintenance" }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border whitespace-nowrap ${
                  filter === f.id 
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' 
                    : 'bg-[#1e293b]/30 border-white/[0.05] text-gray-500 hover:bg-white/[0.05]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-3xl p-6">
            <div className="space-y-4">
              {loading ? (
                <div className="py-12 text-center text-gray-500"><Activity className="w-6 h-6 mx-auto animate-spin" /></div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                  <Shield className="w-8 h-8 mb-3 opacity-20" />
                  <p>No audit logs found for this filter.</p>
                </div>
              ) : (
                filteredLogs.map(log => (
                  <div key={log.id} className="p-4 bg-[#0f172a] border border-white/[0.05] rounded-2xl flex items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                        {getIcon(log.action)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white font-mono">{log.action}</span>
                          <span className="text-xs text-gray-400">on <span className="font-mono text-gray-300">{log.target_type}</span> <span className="font-mono text-gray-500">({log.target_id})</span></span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-mono">Executed by Admin {log.admin_id.split("-")[0]} • IP: {log.ip_address || "127.0.0.1"} • {new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="hidden lg:block text-xs font-mono text-gray-500 bg-[#1e293b]/50 p-2 rounded-lg border border-white/[0.05]">
                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
