"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { MessageSquare, Trash2, Ban, Flag, ShieldAlert, Activity, CheckCircle, XCircle } from "lucide-react";

export default function AdminMessagingDashboard() {
  const { token } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/messages", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setMessages(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [token]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/operations/messages/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMute = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/operations/users/${userId}/mute`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) alert("User muted successfully");
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
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Messaging Operations Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Communications Governance
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Top Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Daily Messages", value: "24.5K", color: "text-blue-400" },
              { label: "Active Conversations", value: "3.2K", color: "text-emerald-400" },
              { label: "Reported Messages", value: "18", color: "text-red-400", alert: true },
              { label: "Blocked Users", value: "142", color: "text-orange-400" }
            ].map((stat, i) => (
              <div key={i} className={`bg-[#1e293b]/30 border p-6 rounded-2xl ${stat.alert ? 'border-red-500/30 bg-red-500/5' : 'border-white/[0.05]'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{stat.label}</span>
                  {stat.alert && <ShieldAlert className="w-3 h-3 text-red-400" />}
                </div>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-3xl p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Flag className="w-5 h-5 text-gray-400" /> Recent / Flagged Messages
            </h2>
            <div className="space-y-4">
              {loading ? (
                <div className="py-12 text-center text-gray-500"><Activity className="w-6 h-6 mx-auto animate-spin" /></div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No messages found.</div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="p-4 bg-[#0f172a] border border-white/[0.05] rounded-2xl flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-gray-300">User ID: <span className="font-mono text-gray-500">{msg.sender_id.split("-")[0]}</span></span>
                        <span className="text-[10px] text-gray-600 font-mono">• {new Date(msg.created_at).toLocaleString()}</span>
                        {msg.deleted_at && <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold uppercase rounded">Deleted</span>}
                      </div>
                      <p className={`text-sm ${msg.deleted_at ? 'text-gray-600 line-through' : 'text-gray-300'}`}>{msg.content}</p>
                    </div>
                    
                    {!msg.deleted_at && (
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <button onClick={() => handleDelete(msg.id)} className="w-full py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 flex items-center justify-center gap-2 transition-all">
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                        <button onClick={() => handleMute(msg.sender_id)} className="w-full py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-bold hover:bg-orange-500/20 flex items-center justify-center gap-2 transition-all">
                          <Ban className="w-3.5 h-3.5" /> Mute User
                        </button>
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
