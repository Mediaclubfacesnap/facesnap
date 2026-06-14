"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Camera, MessageSquare, User, Bell } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Don't show bottom nav on auth pages or desktop
  if (pathname.startsWith("/auth")) return null;

  const navItems = [
    { href: "/dashboard", icon: Home, label: "Home" },
    { href: "/dashboard/communities", icon: Users, label: "Groups" },
    { href: "/dashboard/my-photos", icon: Camera, label: "Photos" },
    { href: "/dashboard/chat", icon: MessageSquare, label: "Chats" },
    { href: "/dashboard/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/[0.05] safe-area-pb">
      <div className="flex items-center justify-around px-2 pb-2 pt-3 h-[70px]">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-14 h-full space-y-1 transition-colors ${
                isActive ? "text-cyan-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <div className="relative">
                <item.icon className={`w-6 h-6 ${isActive ? "fill-cyan-400/20" : ""}`} />
                {item.href === "/dashboard/chat" && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-[#0f172a] rounded-full" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "text-cyan-400" : "text-gray-500"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
