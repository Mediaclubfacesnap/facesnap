"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { AlertTriangle, Clock, Search, Filter, Activity, Plus, CheckCircle, ShieldAlert } from "lucide-react";

export default function AdminIncidentsDashboard() {
  const { token } = useAuthStore();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchIncidents = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/incidents", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setIncidents(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [token]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/operations/incidents/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchIncidents();
    } catch (err) {
      console.error(err);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case "critical": return "text-red-500 bg-red-500/10 border-red-500/20";
      case "high": return "text-orange-400 bg-orange-400/10 border-orange-400/20";
      case "medium": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      default: return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "open": return "text-red-400";
      case "investigating": return "text-amber-400";
      case "resolved": return "text-emerald-400";
      default: return "text-gray-400";
    }
  };

  const filteredIncidents = incidents.filter(i => filter === "all" || i.status === filter);

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Incident Response Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Live Anomaly Tracking
              </p>
            </div>
          </div>
          <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold tracking-wider flex items-center gap-2 transition-all">
            <Plus className="w-4 h-4" /> Declare Incident
          </button>
        </div>

        <div className="p-8 max-w-6xl mx-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {["open", "investigating", "resolved", "closed"].map(stat => {
              const count = incidents.filter(i => i.status === stat).length;
              return (
                <div 
                  key={stat}
                  onClick={() => setFilter(stat)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${filter === stat ? 'bg-white/[0.05] border-white/[0.1]' : 'bg-[#1e293b]/30 border-white/[0.02] hover:bg-white/[0.02]'}`}
                >
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">{stat} Incidents</p>
                  <p className={`text-2xl font-black ${getStatusColor(stat)}`}>{count}</p>
                </div>
              );
            })}
          </div>

          {loading ? (
            <div className="py-20 text-center"><Activity className="w-6 h-6 animate-spin mx-auto text-red-400" /></div>
          ) : (
            <div className="space-y-4">
              {filteredIncidents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-[#1e293b]/30 rounded-3xl border border-white/[0.05]">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-500/50" />
                  <p>No active incidents matching this filter.</p>
                </div>
              ) : (
                filteredIncidents.map(incident => (
                  <div key={incident.id} className="bg-[#1e293b]/40 border border-white/[0.05] p-6 rounded-2xl flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-[#1e293b]/60 transition-colors">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border ${getSeverityColor(incident.severity)}`}>
                          {incident.severity}
                        </span>
                        <h3 className="text-lg font-bold text-white">{incident.title}</h3>
                      </div>
                      <p className="text-sm text-gray-300 mb-4">{incident.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Opened: {new Date(incident.created_at).toLocaleString()}</span>
                        {incident.resolved_at && <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Resolved: {new Date(incident.resolved_at).toLocaleString()}</span>}
                        <span>ID: <span className="font-mono">{incident.id}</span></span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 min-w-[160px]">
                      <select 
                        value={incident.status}
                        onChange={(e) => updateStatus(incident.id, e.target.value)}
                        className={`w-full bg-[#0f172a] border border-white/[0.1] text-xs font-bold rounded-lg px-3 py-2 outline-none uppercase tracking-wider ${getStatusColor(incident.status)}`}
                      >
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      
                      {incident.status !== 'resolved' && incident.status !== 'closed' && (
                        <button 
                          onClick={() => updateStatus(incident.id, "resolved")}
                          className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
