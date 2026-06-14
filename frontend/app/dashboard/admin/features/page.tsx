"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { Flag, Activity, Play, Pause, Save } from "lucide-react";

export default function AdminFeatureFlagsDashboard() {
  const { token } = useAuthStore();
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/feature-flags", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setFlags(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [token]);

  const updateFlag = async (id: string, updates: any) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/operations/feature-flags/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        fetchFlags();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Flag className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Feature Flags
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Progressive Rollout Management
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-5xl mx-auto">
          {loading ? (
            <div className="py-20 text-center"><Activity className="w-6 h-6 animate-spin mx-auto text-emerald-400" /></div>
          ) : flags.length === 0 ? (
            <div className="bg-[#1e293b]/30 border border-white/[0.05] p-12 text-center rounded-3xl">
              <p className="text-gray-400">No feature flags registered in the system.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {flags.map((flag) => (
                <div key={flag.id} className="bg-[#1e293b]/30 border border-white/[0.05] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-[#1e293b]/50 transition-colors">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">{flag.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${flag.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                        {flag.enabled ? 'Live' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{flag.description || "No description provided."}</p>
                    <p className="text-xs text-gray-500 mt-2 font-mono">ID: {flag.id} • Last Updated: {new Date(flag.updated_at).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="flex flex-col gap-4 min-w-[200px]">
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-semibold text-gray-300">
                        <span>Rollout %</span>
                        <span className="text-emerald-400">{flag.rollout_percentage}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" step="5"
                        value={flag.rollout_percentage}
                        onChange={(e) => updateFlag(flag.id, { rollout_percentage: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-gray-500 mt-1 uppercase tracking-wider">
                        <span>Admins Only</span>
                        <span>100%</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => updateFlag(flag.id, { enabled: !flag.enabled })}
                      className={`w-full py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 border ${flag.enabled ? 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] text-gray-300' : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400'}`}
                    >
                      {flag.enabled ? <><Pause className="w-3.5 h-3.5" /> Disable Feature</> : <><Play className="w-3.5 h-3.5" /> Enable Feature</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
