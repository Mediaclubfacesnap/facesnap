"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, Users, Activity, Lock, Smartphone, Search, AlertTriangle, UserX } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function AdminSecurityPage() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState("overview");

  // Mocked Metrics for Sprint 11 Dashboard
  const metrics = {
    activeSessions: 1420,
    failedLogins24h: 345,
    adoption2FA: "68%",
    securityAlerts: 42,
    suspiciousLogins: 18,
    lockedAccounts: 7
  };

  const alertFeed = [
    { type: 'Multiple Failed Logins', user: '@johndoe', time: '2 mins ago', severity: 'HIGH' },
    { type: 'New Country Login', user: '@sarahsmith', time: '15 mins ago', severity: 'MEDIUM' },
    { type: 'Face Data Deletion Request', user: '@mike_j', time: '1 hour ago', severity: 'CRITICAL' },
    { type: 'Brute Force Attempt', user: 'unknown IP', time: '2 hours ago', severity: 'CRITICAL' },
    { type: 'Password Changed', user: '@alex123', time: '3 hours ago', severity: 'LOW' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
            Platform Security & Compliance
          </h1>
          <p className="text-gray-400 mt-1">Monitor platform-wide security events, threats, and 2FA adoption.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 font-semibold text-sm tracking-wide uppercase">Live Monitoring</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Active Sessions', value: metrics.activeSessions, icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Failed Logins (24h)', value: metrics.failedLogins24h, icon: Activity, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: '2FA Adoption', value: metrics.adoption2FA, icon: Lock, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Security Alerts', value: metrics.securityAlerts, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Suspicious Logins', value: metrics.suspiciousLogins, icon: Search, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Locked Accounts', value: metrics.lockedAccounts, icon: UserX, color: 'text-rose-400', bg: 'bg-rose-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#1e293b]/50 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Security Events Timeline</h2>
              <select className="bg-black/40 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none">
                <option>Last 24 Hours</option>
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
            
            {/* Mock Chart Area */}
            <div className="flex-1 border-b border-l border-white/10 relative flex items-end justify-between px-4 pb-4 pt-10">
              {[40, 65, 30, 85, 45, 90, 50, 70, 25, 60, 80, 55].map((h, i) => (
                <div key={i} className="w-1/12 px-1 flex flex-col justify-end group">
                  <div 
                    className="w-full bg-rose-500/20 hover:bg-rose-500/40 border-t-2 border-rose-500 rounded-t-sm transition-all relative"
                    style={{ height: `${h}%` }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black px-2 py-1 rounded text-xs text-white">
                      {h * 2} Events
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Alert Monitor Sidebar */}
        <div className="bg-[#1e293b]/50 border border-white/5 rounded-3xl p-6 flex flex-col h-[400px]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-gray-400" />
            Live Alert Monitor
          </h2>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 hide-scrollbar">
            {alertFeed.map((alert, i) => (
              <div key={i} className="bg-black/20 border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    alert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                    alert.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                    alert.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-500">{alert.time}</span>
                </div>
                <div className="text-white font-medium text-sm mt-1">{alert.type}</div>
                <div className="text-gray-400 text-xs mt-1">User: {alert.user}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
