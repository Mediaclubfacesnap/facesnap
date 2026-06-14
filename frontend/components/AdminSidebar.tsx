"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  Shield, Home, Compass, Search, LogOut, Camera, MessageSquare, 
  UserCheck, BarChart3, Cpu, Activity, Server, DatabaseBackup, 
  Smartphone, Bell, Flag, AlertTriangle, PlayCircle, Settings
} from "lucide-react";

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isEmergencyLocked, setEmergencyLocked] = useState(false);

  const handleSignOut = () => { logout(); router.push("/"); };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "Discover", href: "/dashboard/discover", icon: Compass },
    { label: "My Photos", href: "/dashboard/my-photos", icon: Camera },
    { label: "Private Chat", href: "/dashboard/chat", icon: MessageSquare },
    { label: "Smart Search", href: "/dashboard/search", icon: Search },
  ];

  const adminModules = [
    { label: "Global Operations", href: "/dashboard/admin/operations", icon: BarChart3 },
    { label: "User Management", href: "/dashboard/admin/users", icon: UserCheck },
    { label: "Communities", href: "/dashboard/admin/communities", icon: Shield },
    { label: "Media Operations", href: "/dashboard/admin/media", icon: Camera },
    { label: "Messaging", href: "/dashboard/admin/messages", icon: MessageSquare },
    { label: "Moderation Queue", href: "/dashboard/admin/moderation", icon: Shield },
    { label: "Announcements", href: "/dashboard/admin/announcements", icon: Bell },
    { label: "Incident Response", href: "/dashboard/admin/incidents", icon: AlertTriangle },
    { label: "Feature Flags", href: "/dashboard/admin/features", icon: Flag },
    { label: "Maintenance", href: "/dashboard/admin/maintenance", icon: Settings },
    { label: "Storage Center", href: "/dashboard/admin/storage", icon: DatabaseBackup },
    { label: "Memories Analytics", href: "/dashboard/admin/memories", icon: Activity },
    { label: "Audit Replay", href: "/dashboard/admin/audit", icon: Activity },
    { label: "Platform Health", href: "/dashboard/admin/health", icon: Server },
    { label: "Launch Readiness", href: "/dashboard/admin/launch", icon: PlayCircle },
    { label: "Verification Suite", href: "/dashboard/admin/verify", icon: Cpu },
    { label: "Security Center", href: "/dashboard/admin/security", icon: Shield },
  ];

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20 overflow-y-auto custom-scrollbar">
      <div className="px-5 py-5 border-b border-white/[0.06] sticky top-0 bg-[#0a0f1a]/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-red-500/20 to-amber-500/20 border border-white/[0.08]">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-wider text-white">FaceSnap</span>
            <span className="block text-[7px] tracking-[0.2em] text-amber-400 font-bold uppercase -mt-0.5">
              Operations Center
            </span>
          </div>
        </div>
      </div>

      <nav className="px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 mt-2 pb-6">
        <div className="px-3 py-2">
          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Platform Modules</span>
        </div>
        <div className="space-y-1">
          {adminModules.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-gray-300 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto px-3 py-4 border-t border-white/[0.06] sticky bottom-0 bg-[#0a0f1a]/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
            {user?.full_name?.charAt(0)?.toUpperCase() || "A"}
          </div>
          <div className="flex-grow min-w-0">
            <span className="text-xs font-bold text-white block truncate">{user?.full_name || "Admin"}</span>
            <span className="text-[10px] text-amber-400 block truncate font-semibold">Super Admin</span>
          </div>
          <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all" title="Sign Out">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
