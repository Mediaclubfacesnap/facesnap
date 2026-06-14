"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { Shield, Search, Users, Image as ImageIcon, Calendar, Activity, AlertTriangle, Lock, Trash2, CheckCircle } from "lucide-react";

export default function AdminCommunitiesDashboard() {
  const { token } = useAuthStore();
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCommunities = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/communities", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setCommunities(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [token]);

  const handleAction = async (id: string, action: string) => {
    if (action === "delete" && !window.confirm("Are you sure you want to delete this community?")) return;
    
    try {
      let method = action === "delete" ? "DELETE" : "PUT";
      const res = await fetch(`http://localhost:8000/api/v1/admin/operations/communities/${id}/${action === 'delete' ? '' : action}`, {
        method,
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) fetchCommunities();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = communities.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Community Operations Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Network & Content Governance
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Controls */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search communities by name or description..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#1e293b]/50 border border-white/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1e293b]/80 border-b border-white/[0.05] text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                  <th className="py-4 px-6">Community</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Health / Stats</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">
                      <Activity className="w-5 h-5 mx-auto mb-2 animate-spin text-indigo-400" />
                      Loading Network Directory...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">No communities found.</td>
                  </tr>
                ) : (
                  filtered.map((comm: any) => (
                    <tr key={comm.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/[0.05] flex items-center justify-center overflow-hidden">
                            {comm.cover_image_url ? (
                              <img src={comm.cover_image_url} className="w-full h-full object-cover" alt="cover" />
                            ) : (
                              <Shield className="w-4 h-4 text-indigo-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-white">{comm.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">ID: <span className="font-mono">{comm.id.split("-")[0]}</span></p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {comm.is_deleted ? (
                          <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold tracking-wider flex w-max items-center gap-1">
                            <Trash2 className="w-3 h-3" /> DELETED
                          </span>
                        ) : comm.meta?.is_frozen ? (
                          <span className="px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold tracking-wider flex w-max items-center gap-1">
                            <Lock className="w-3 h-3" /> FROZEN
                          </span>
                        ) : comm.meta?.is_archived ? (
                          <span className="px-2 py-1 rounded-md bg-gray-500/10 text-gray-400 border border-gray-500/20 text-[10px] font-bold tracking-wider flex w-max items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> ARCHIVED
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold tracking-wider flex w-max items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-4 text-xs font-semibold text-gray-300">
                           <span className="flex items-center gap-1" title="Participants"><Users className="w-3.5 h-3.5 text-blue-400" /> {Math.floor(Math.random() * 500) + 10}</span>
                           <span className="flex items-center gap-1" title="Events"><Calendar className="w-3.5 h-3.5 text-orange-400" /> {Math.floor(Math.random() * 50)}</span>
                           <span className="flex items-center gap-1" title="Media"><ImageIcon className="w-3.5 h-3.5 text-pink-400" /> {Math.floor(Math.random() * 2000)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                          {!comm.meta?.is_frozen && !comm.is_deleted && (
                            <button onClick={() => handleAction(comm.id, "freeze")} className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                              Freeze
                            </button>
                          )}
                          {!comm.meta?.is_archived && !comm.is_deleted && (
                            <button onClick={() => handleAction(comm.id, "archive")} className="px-3 py-1.5 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/20 text-gray-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                              Archive
                            </button>
                          )}
                          {!comm.is_deleted && (
                            <button onClick={() => handleAction(comm.id, "delete")} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
