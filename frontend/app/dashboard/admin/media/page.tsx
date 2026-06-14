"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { Camera, RefreshCw, Trash2, Database, HardDrive, Image as ImageIcon, Video, Folder, Archive, CheckCircle, Activity } from "lucide-react";

export default function AdminMediaDashboard() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMedia = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/media", {
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
    fetchMedia();
  }, [token]);

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/operations/media/${id}/${action}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) alert(`Action ${action} initiated successfully.`);
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
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Camera className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Media Operations Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Storage & Processing Pipeline
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Top Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Photos", value: stats?.total_photos || 0, icon: ImageIcon, color: "text-blue-400" },
              { label: "Total Videos", value: 0, icon: Video, color: "text-orange-400" },
              { label: "Total Albums", value: 0, icon: Folder, color: "text-purple-400" },
              { label: "Storage Used", value: "24.5 GB", icon: HardDrive, color: "text-emerald-400" }
            ].map((stat, i) => (
              <div key={i} className="bg-[#1e293b]/30 border border-white/[0.05] p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{stat.label}</span>
                </div>
                <p className="text-2xl font-black">{loading ? <Activity className="w-5 h-5 animate-spin my-1" /> : stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-[#1e293b]/30 border border-white/[0.05] rounded-3xl p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-gray-400" /> Recent Uploads
              </h2>
              <div className="space-y-4">
                {loading ? (
                  <p className="text-sm text-gray-500">Loading media...</p>
                ) : stats?.recent_uploads?.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent media found.</p>
                ) : (
                  stats?.recent_uploads?.map((media: any) => (
                    <div key={media.id} className="flex items-center justify-between p-4 bg-[#0f172a] border border-white/[0.05] rounded-2xl hover:bg-white/[0.02] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-800 overflow-hidden">
                          <img src={media.file_url} className="w-full h-full object-cover" alt="Media" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white font-mono">ID: {media.id.split("-")[0]}</p>
                          <p className="text-xs text-gray-500">{new Date(media.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleAction(media.id, 'reindex')} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20" title="Reindex Search">
                          <Database className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAction(media.id, 'rebuild-metadata')} className="p-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20" title="Rebuild Metadata">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAction(media.id, 'delete')} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20" title="Delete Media">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-3xl p-6">
                <h2 className="text-sm font-bold text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Database className="w-4 h-4" /> Global Actions
                </h2>
                <div className="space-y-3">
                  <button className="w-full py-3 bg-[#0f172a] border border-white/[0.1] hover:bg-white/[0.05] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-400" /> Rebuild Face Matches
                  </button>
                  <button className="w-full py-3 bg-[#0f172a] border border-white/[0.1] hover:bg-white/[0.05] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" /> Reindex All Media (Elastic)
                  </button>
                  <button className="w-full py-3 bg-[#0f172a] border border-white/[0.1] hover:bg-white/[0.05] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <Archive className="w-4 h-4 text-gray-400" /> Move Old Media to Glacier
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
