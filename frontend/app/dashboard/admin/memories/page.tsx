"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Clock, Image as ImageIcon, Users, Calendar, ArrowUpRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminMemoriesAnalytics() {
  const { user, isAuthenticated, token } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || (user?.platform_role !== "super_admin" && user?.platform_role !== "admin")) {
      router.push("/dashboard");
      return;
    }

    const fetchAnalytics = async () => {
      try {
        // We'll mock the analytics data since we haven't built the explicit admin/memories endpoint yet
        // In a real implementation this would fetch from /api/v1/admin/operations/memories/stats
        setStats({
          total_memories: 1428,
          total_memory_photos: 48920,
          generation_time_avg_ms: 1240,
          growth_rate: "+12.4%",
          top_events: [
            { id: "1", title: "Tech Fest 2026", memories: 120 },
            { id: "2", title: "Graduation", memories: 85 }
          ]
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [isAuthenticated, user, router, token]);

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen bg-[#030712] flex">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] flex">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-50 flex items-center gap-3">
                <Activity className="w-8 h-8 text-primary" />
                Memory Generation Analytics
              </h1>
              <p className="text-gray-400 mt-1">Platform-wide statistics for the AI Memory Timeline engine</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium border border-green-500/20 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                Engine Online
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-5 rounded-xl glass-panel border border-white/[0.06]">
              <div className="flex justify-between items-start mb-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" /> {stats.growth_rate}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mt-4">{stats.total_memories.toLocaleString()}</h3>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mt-1">Total Memories</p>
            </div>

            <div className="p-5 rounded-xl glass-panel border border-white/[0.06]">
              <div className="flex justify-between items-start mb-2">
                <ImageIcon className="w-5 h-5 text-tertiary" />
              </div>
              <h3 className="text-2xl font-bold text-white mt-4">{stats.total_memory_photos.toLocaleString()}</h3>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mt-1">Memory Photos</p>
            </div>

            <div className="p-5 rounded-xl glass-panel border border-white/[0.06]">
              <div className="flex justify-between items-start mb-2">
                <Users className="w-5 h-5 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold text-white mt-4">2.4</h3>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mt-1">Avg People per Memory</p>
            </div>

            <div className="p-5 rounded-xl glass-panel border border-white/[0.06]">
              <div className="flex justify-between items-start mb-2">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-white mt-4">{stats.generation_time_avg_ms}ms</h3>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mt-1">Avg Generation Time</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl glass-panel border border-white/[0.06]">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Top Memory Generating Events</h2>
              <div className="space-y-3">
                {stats.top_events.map((event: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        #{i + 1}
                      </div>
                      <span className="font-medium text-gray-200">{event.title}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary">{event.memories} Memories</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-xl glass-panel border border-white/[0.06]">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Worker Status</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                  <div>
                    <h4 className="text-sm font-medium text-gray-200">Incremental Generator</h4>
                    <p className="text-xs text-gray-500">app.workers.memory_tasks.generate_user_memories</p>
                  </div>
                  <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">ACTIVE</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                  <div>
                    <h4 className="text-sm font-medium text-gray-200">Nightly Consolidation</h4>
                    <p className="text-xs text-gray-500">app.workers.memory_tasks.nightly_memory_consolidation</p>
                  </div>
                  <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">SCHEDULED (04:00)</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
