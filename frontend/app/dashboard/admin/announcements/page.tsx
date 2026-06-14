"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { Megaphone, Send, Bell, User, Users, Layers, Type, MessageSquare, CheckCircle, ShieldAlert, Activity } from "lucide-react";

export default function AdminAnnouncementsDashboard() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "notification",
    target: "all_users"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/announcements", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSuccess(true);
        setFormData({ title: "", message: "", type: "notification", target: "all_users" });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Announcement Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Global Push & In-App Messaging
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-[#1e293b]/30 border border-white/[0.05] p-8 rounded-3xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Send className="w-5 h-5 text-pink-400" /> Dispatch New Announcement
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Message Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "notification", label: "Push Notif", icon: Bell },
                      { id: "banner", label: "UI Banner", icon: Type },
                      { id: "popup", label: "App Modal", icon: MessageSquare }
                    ].map(type => (
                      <div 
                        key={type.id}
                        onClick={() => setFormData({ ...formData, type: type.id })}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${formData.type === type.id ? 'bg-pink-500/20 border-pink-500/30 text-pink-400' : 'bg-[#0f172a] border-white/[0.1] text-gray-500 hover:border-white/[0.2]'}`}
                      >
                        <type.icon className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">{type.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Target Audience</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "all_users", label: "All Users", icon: Users },
                      { id: "admins", label: "Admins Only", icon: ShieldAlert },
                      { id: "communities", label: "Communities", icon: Layers }
                    ].map(target => (
                      <div 
                        key={target.id}
                        onClick={() => setFormData({ ...formData, target: target.id })}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${formData.target === target.id ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-[#0f172a] border-white/[0.1] text-gray-500 hover:border-white/[0.2]'}`}
                      >
                        <target.icon className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">{target.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Headline / Title</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Scheduled Maintenance Downtime" 
                  className="w-full bg-[#0f172a] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-pink-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Message Body</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Provide the full announcement details here..." 
                  className="w-full bg-[#0f172a] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-pink-500/50 resize-none custom-scrollbar"
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl font-bold tracking-wider shadow-lg shadow-pink-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Activity className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Dispatch Announcement</>}
              </button>

              {success && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Announcement successfully queued for broadcast!
                </div>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
