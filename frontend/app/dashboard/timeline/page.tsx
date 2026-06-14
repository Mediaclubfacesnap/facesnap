"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { 
  ArrowLeft, Calendar, Award, Sparkles, Loader2, 
  CheckCircle2, Flame, Shield, Star, Camera, Compass, Trophy
} from "lucide-react";
import Navbar from "@/components/Navbar";

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

interface PersonalTimelineData {
  points_balance: number;
  badges: Array<{ badge_type: string }>;
  timeline: TimelineItem[];
}

export default function PersonalTimelinePage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuthStore();
  const [data, setData] = useState<PersonalTimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTimelineData = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/users/me/timeline`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch timeline data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchTimelineData();
  }, [isAuthenticated, token]);

  const getBadgeIcon = (type: string) => {
    const icons: Record<string, any> = {
      top_contributor: <Trophy className="w-5 h-5 text-yellow-400" />,
      top_photographer: <Camera className="w-5 h-5 text-primary" />,
      event_organizer: <Calendar className="w-5 h-5 text-purple-400" />,
      community_leader: <Shield className="w-5 h-5 text-emerald-400" />,
      streak_30: <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
    };
    return icons[type] || <Star className="w-5 h-5 text-gray-400" />;
  };

  const getBadgeLabel = (type: string) => {
    const labels: Record<string, string> = {
      top_contributor: "🏆 Top Contributor",
      top_photographer: "📸 Top Photographer",
      event_organizer: "🎉 Event Organizer",
      community_leader: "👑 Community Leader",
      streak_30: "🔥 30 Day Streak"
    };
    return labels[type] || "🌟 Community Champion";
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712] gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Synchronizing timeline records...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col justify-between">
      <Navbar />

      <main className="flex-grow max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Back Link */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* Profile Card Header */}
        <div className="p-8 rounded-2xl glass-panel border border-white/[0.08] relative overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-accentCyan to-accentRed"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="text-[9px] font-bold text-primary uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">Ecosystem Roster</span>
              <h1 className="text-2xl font-extrabold tracking-tight mt-3 font-display">My Professional Timeline</h1>
              <p className="text-xs text-gray-400 mt-1">Review your points progress, unlocked credentials, and active milestones.</p>
            </div>
            
            <div className="flex gap-4">
              <div className="p-4.5 rounded-xl bg-black/40 border border-white/[0.06] text-center shrink-0 min-w-[100px]">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block">Points Balance</span>
                <span className="text-xl font-extrabold text-primary block mt-1">{data?.points_balance || 0} PTS</span>
              </div>
              <div className="p-4.5 rounded-xl bg-black/40 border border-white/[0.06] text-center shrink-0 min-w-[100px]">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block">Roster Badges</span>
                <span className="text-xl font-extrabold text-emerald-400 block mt-1">{data?.badges?.length || 0} Unlocked</span>
              </div>
            </div>
          </div>
        </div>

        {/* Badges Panel */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
            <Award className="w-4.5 h-4.5 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Credentials & Badges Unlocked</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {data?.badges?.map((badge, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl glass-panel border border-white/[0.06] hover:border-primary/20 transition-all flex items-center gap-4 bg-[#0a0f1a]/40"
              >
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shrink-0">
                  {getBadgeIcon(badge.badge_type)}
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white leading-tight">{getBadgeLabel(badge.badge_type)}</h4>
                  <span className="text-[9px] text-gray-500 block mt-1 uppercase font-semibold tracking-wider">Ecosystem Accomplished</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chronological Milestone Timeline */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
            <Sparkles className="w-4.5 h-4.5 text-primary animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Accomplishment Journey Feed</h3>
          </div>

          <div className="relative border-l border-white/[0.08] pl-6 ml-4 space-y-8">
            {data?.timeline?.map((item) => (
              <div key={item.id} className="relative group">
                {/* Timeline node dot indicator */}
                <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-[#030712] border border-primary/40 flex items-center justify-center transition-all group-hover:scale-110">
                  <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#00e5ff]"></span>
                </div>

                <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] hover:border-primary/10 transition-all bg-[#0a0f1a]/20">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded border border-primary/20 text-primary uppercase tracking-widest">{item.type.replace('_', ' ')}</span>
                    <span className="text-[9px] text-gray-500 font-semibold">{new Date(item.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white mt-2 font-display">{item.title}</h4>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
