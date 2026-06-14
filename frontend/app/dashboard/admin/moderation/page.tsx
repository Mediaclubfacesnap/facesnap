"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { Shield, ShieldAlert, CheckCircle, Ban, MessageSquare, Camera, Users, Filter } from "lucide-react";

export default function AdminModerationDashboard() {
  const { token } = useAuthStore();
  const [filter, setFilter] = useState("pending");

  // Mock moderation queue data for demonstration
  const [queue, setQueue] = useState([
    { id: "mod-1", type: "photo", target: "photo_123", status: "pending", reason: "Inappropriate Content", reporter: "user_456", date: new Date().toISOString() },
    { id: "mod-2", type: "message", target: "msg_789", status: "pending", reason: "Spam", reporter: "user_111", date: new Date().toISOString() },
    { id: "mod-3", type: "user", target: "user_999", status: "reviewing", reason: "Fake Profile", reporter: "user_222", date: new Date().toISOString() }
  ]);

  const handleAction = (id: string, action: string) => {
    setQueue(queue.map(q => q.id === id ? { ...q, status: action } : q));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "photo": return <Camera className="w-4 h-4 text-pink-400" />;
      case "message": return <MessageSquare className="w-4 h-4 text-teal-400" />;
      case "user": return <Users className="w-4 h-4 text-blue-400" />;
      default: return <ShieldAlert className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredQueue = queue.filter(q => q.status === filter);

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Moderation & Abuse Queue
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Centralized Reporting Triage
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Quick Filters */}
          <div className="flex gap-2 mb-8">
            {["pending", "reviewing", "action_taken", "dismissed"].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                  filter === status 
                    ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' 
                    : 'bg-[#1e293b]/30 border-white/[0.05] text-gray-500 hover:bg-white/[0.05]'
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-3xl p-6">
            <div className="space-y-4">
              {filteredQueue.length === 0 ? (
                <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                  <Shield className="w-8 h-8 mb-3 opacity-20" />
                  <p>No reports found for this filter.</p>
                </div>
              ) : (
                filteredQueue.map(item => (
                  <div key={item.id} className="p-5 bg-[#0f172a] border border-white/[0.05] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                        {getIcon(item.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-white uppercase">{item.type} Report</span>
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold uppercase rounded">
                            {item.reason}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-1">Target ID: <span className="font-mono text-gray-500">{item.target}</span></p>
                        <p className="text-[10px] text-gray-600 font-mono">Reported by {item.reporter} • {new Date(item.date).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {item.status === 'pending' && (
                        <button onClick={() => handleAction(item.id, 'reviewing')} className="px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition-all">
                          Start Review
                        </button>
                      )}
                      {(item.status === 'pending' || item.status === 'reviewing') && (
                        <>
                          <button onClick={() => handleAction(item.id, 'action_taken')} className="px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all flex items-center gap-1">
                            <Ban className="w-3 h-3" /> Take Action
                          </button>
                          <button onClick={() => handleAction(item.id, 'dismissed')} className="px-3 py-2 bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-lg text-xs font-bold hover:bg-gray-500/20 transition-all flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Dismiss
                          </button>
                        </>
                      )}
                    </div>
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
