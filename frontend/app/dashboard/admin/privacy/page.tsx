"use client";

import { useState, useEffect } from "react";
import { Shield, EyeOff, DownloadCloud, Trash2, Loader2, ArrowUpRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function AdminPrivacyDashboard() {
  const { token, user } = useAuthStore();
  const [metrics, setMetrics] = useState({
    usersWithMatchingEnabled: 0,
    usersWithMatchingDisabled: 0,
    publicProfiles: 0,
    hiddenProfiles: 0,
    exportsGenerated: 0,
    deletionRequests: 0,
    presetUsage: { STANDARD: 0, PRIVATE: 0, INVISIBLE: 0, CUSTOM: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);

  // In a real implementation, you would fetch these from GET /api/v1/privacy/admin/metrics
  // Since we didn't implement the admin backend route yet, we'll mock the data for UI demonstration.
  useEffect(() => {
    setTimeout(() => {
      setMetrics({
        usersWithMatchingEnabled: 14050,
        usersWithMatchingDisabled: 342,
        publicProfiles: 12000,
        hiddenProfiles: 2392,
        exportsGenerated: 145,
        deletionRequests: 12,
        presetUsage: { STANDARD: 12000, PRIVATE: 1500, INVISIBLE: 342, CUSTOM: 550 }
      });
      setIsLoading(false);
    }, 1000);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Privacy & Compliance</h1>
        <p className="text-sm text-gray-400 mt-1">Platform-wide overview of user privacy configurations and data requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Matching Enabled" 
          value={metrics.usersWithMatchingEnabled} 
          subValue={`${metrics.usersWithMatchingDisabled} Disabled`} 
          icon={Shield} 
          color="text-green-400" 
        />
        <MetricCard 
          title="Public Profiles" 
          value={metrics.publicProfiles} 
          subValue={`${metrics.hiddenProfiles} Hidden`} 
          icon={EyeOff} 
          color="text-blue-400" 
        />
        <MetricCard 
          title="Data Exports" 
          value={metrics.exportsGenerated} 
          subValue="Last 30 days" 
          icon={DownloadCloud} 
          color="text-purple-400" 
        />
        <MetricCard 
          title="Face Deletions" 
          value={metrics.deletionRequests} 
          subValue="Pending processing" 
          icon={Trash2} 
          color="text-red-400" 
        />
      </div>

      <div className="p-6 rounded-2xl glass-panel border border-white/10 mt-6">
        <h3 className="text-lg font-bold font-display text-white mb-6">Privacy Preset Adoption</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(metrics.presetUsage).map(([preset, count]) => (
            <div key={preset} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-2xl font-bold text-white mb-1">{count}</div>
              <div className="text-xs text-gray-400">{preset}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subValue, icon: Icon, color }: any) {
  return (
    <div className="p-5 rounded-2xl glass-panel border border-white/10 relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-xl bg-white/5 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
      </div>
      <div>
        <h3 className="text-3xl font-display font-bold text-white tracking-tight">{value.toLocaleString()}</h3>
        <p className="text-sm font-medium text-gray-300 mt-1">{title}</p>
        <p className="text-xs text-gray-500 mt-1">{subValue}</p>
      </div>
    </div>
  );
}
