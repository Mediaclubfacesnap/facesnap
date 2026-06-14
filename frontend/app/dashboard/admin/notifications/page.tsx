"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Activity, Bell, Mail, Smartphone, RefreshCw, BarChart2 } from "lucide-react";

interface AnalyticsData {
  metrics: {
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    total_dismissed: number;
  };
  rates: {
    open_rate_percent: number;
    click_rate_percent: number;
    dismiss_rate_percent: number;
  };
  distribution: Record<string, number>;
}

export default function NotificationAnalyticsPage() {
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuthStore();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (user?.platform_role !== "super_admin") {
      router.push("/dashboard");
      return;
    }
    fetchAnalytics();
  }, [isAuthenticated, user]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-50 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Notification Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            System-wide notification delivery, engagement, and category distribution metrics.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Refresh Data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-6 rounded-xl glass-panel border border-white/[0.06]">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Sent</span>
          <span className="block text-3xl font-display font-bold text-gray-50 mt-2">{data.metrics.total_sent}</span>
        </div>
        <div className="p-6 rounded-xl glass-panel border border-primary/20 bg-primary/[0.02]">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Opened</span>
          <span className="block text-3xl font-display font-bold text-primary mt-2">{data.metrics.total_opened}</span>
          <span className="block text-xs font-medium text-emerald-400 mt-1">{data.rates.open_rate_percent}% Rate</span>
        </div>
        <div className="p-6 rounded-xl glass-panel border border-tertiary/20 bg-tertiary/[0.02]">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Clicked</span>
          <span className="block text-3xl font-display font-bold text-tertiary mt-2">{data.metrics.total_clicked}</span>
          <span className="block text-xs font-medium text-emerald-400 mt-1">{data.rates.click_rate_percent}% Rate</span>
        </div>
        <div className="p-6 rounded-xl glass-panel border border-red-500/20 bg-red-500/[0.02]">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Dismissed</span>
          <span className="block text-3xl font-display font-bold text-red-400 mt-2">{data.metrics.total_dismissed}</span>
          <span className="block text-xs font-medium text-red-400 mt-1">{data.rates.dismiss_rate_percent}% Rate</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-6 rounded-xl glass-panel border border-white/[0.06]">
          <h2 className="text-lg font-semibold text-gray-50 flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-primary" />
            Distribution by Type
          </h2>
          <div className="space-y-4">
            {Object.entries(data.distribution).map(([type, count]) => {
              const percentage = data.metrics.total_sent > 0 ? ((count / data.metrics.total_sent) * 100).toFixed(1) : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-300 capitalize">{type.replace("_", " ")}</span>
                    <span className="text-gray-400">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
