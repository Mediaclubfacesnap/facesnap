"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Camera, LogOut, Menu, X, Bell, Loader2, Sparkles, CheckCircle2, Search } from "lucide-react";
import Magnetic from "./Magnetic";

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout, token } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const navbarSearchRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalK = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        if (window.location.pathname !== "/dashboard/search") {
          e.preventDefault();
          navbarSearchRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalK);
    return () => window.removeEventListener("keydown", handleGlobalK);
  }, []);

  const handleSignOut = () => {
    logout();
    router.push("/");
  };

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    try {
      const [notifRes, countRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/face-matches`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (notifRes.ok) {
        setNotifications(await notifRes.json());
      }
      if (countRes.ok) {
        const countData = await countRes.json();
        setUnreadCount(countData.count);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchNotifications]);

  const handleMarkAsRead = async (notifId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/${notifId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!token) return;
    
    // 1. Mark as read
    if (!notif.is_read) {
      await handleMarkAsRead(notif.id);
    }
    
    // 2. Track analytics click
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/${notif.id}/click`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.error("Failed to track click analytics:", e);
    }
    
    // 3. Close drawer and deep link redirect
    setShowNotifications(false);
    router.push(notif.target_url || "/dashboard/my-photos");
  };

  // Close mobile menu on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && mobileOpen) {
      setMobileOpen(false);
    }
  }, [mobileOpen]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/[0.06] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* LOGO */}
        <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2.5 group" aria-label="FaceSnap home">
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <Camera className="w-4 h-4 text-[#030712]" />
          </div>
          <span className="text-lg font-display font-bold tracking-tight text-gray-50">
            FaceSnap
          </span>
        </Link>

        {/* GLOBAL NAVBAR SEARCH */}
        {isAuthenticated && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const target = e.currentTarget.elements.namedItem("search") as HTMLInputElement;
              if (target?.value.trim()) {
                router.push(`/dashboard/search?q=${encodeURIComponent(target.value.trim())}`);
                target.value = "";
                // Blur the input after search to release focus
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }
            }}
            className="hidden md:flex items-center relative max-w-[160px] lg:max-w-xs w-full mx-4"
          >
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
            <input
              ref={navbarSearchRef}
              type="text"
              name="search"
              placeholder="Search... [Ctrl+K]"
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[11px] font-semibold text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-gray-500"
            />
          </form>
        )}
 
        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400" aria-label="Main navigation">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="hover:text-gray-50 transition-colors duration-200 py-1">
                Dashboard
              </Link>
              <Link href="/dashboard/discover" className="hover:text-gray-50 transition-colors duration-200 py-1">
                Discover
              </Link>
              <Link href="/dashboard/memories" className="hover:text-gray-50 transition-colors duration-200 py-1">
                Memories
              </Link>
              <Link href="/dashboard/security" className="hover:text-gray-50 transition-colors duration-200 py-1">
                Security
              </Link>
            </>
          ) : (
            <>
              <a href="#features" className="hover:text-gray-50 transition-colors duration-200 py-1">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-gray-50 transition-colors duration-200 py-1">
                How It Works
              </a>
            </>
          )}
        </nav>
 
        {/* DESKTOP AUTH */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-primary/40 text-gray-400 hover:text-white transition-all duration-300"
                  aria-label="Toggle notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[8px] font-extrabold text-white flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>
 
                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 rounded-2xl glass-panel border border-white/[0.08] bg-[#0a0f1a]/95 backdrop-blur-xl p-4 shadow-2xl z-50">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Face Matches Alerts
                      </span>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-[9px] text-primary hover:text-cyan-400 font-bold uppercase transition-all">
                            Mark All Read
                          </button>
                        )}
                        <span className="text-[10px] text-gray-500 font-medium">
                          {unreadCount} unread
                        </span>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-none">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-xs">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          // Dynamic badge rendering by type (Module 10)
                          const isDigest = notif.notification_type === "weekly_digest";
                          const isEvent = notif.notification_type === "event_match";
                          const isComm = notif.notification_type === "community_match";
                          
                          let badgeText = "Face Match";
                          let badgeColor = "bg-primary/10 border-primary/20 text-primary";
                          if (isDigest) {
                            badgeText = "Weekly digest";
                            badgeColor = "bg-emerald-500/10 border-emerald-500/25 text-emerald-400";
                          } else if (isEvent) {
                            badgeText = "Event Match";
                            badgeColor = "bg-amber-500/10 border-amber-500/25 text-amber-400";
                          } else if (isComm) {
                            badgeText = "Group Match";
                            badgeColor = "bg-cyan-500/10 border-cyan-500/25 text-cyan-400";
                          }

                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-3 rounded-xl border transition-all text-left block relative group cursor-pointer ${
                                notif.is_read
                                  ? "bg-white/[0.02] border-white/[0.04] text-gray-400"
                                  : "bg-white/[0.04] border-white/[0.08] hover:border-primary/40 text-white"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${badgeColor}`}>
                                  {badgeText}
                                </span>
                                {!notif.is_read && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1 animate-pulse"></span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-200 mt-2 font-semibold leading-relaxed">
                                {notif.title}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed whitespace-pre-line">
                                {notif.message}
                              </p>
                              <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-white/[0.04] text-[8px] text-gray-500">
                                <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                                <span className="text-primary group-hover:underline">View Photos →</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-xs font-semibold text-white">
                  {user?.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <span className="text-sm text-gray-300 font-medium max-w-[120px] truncate">
                  {user?.full_name}
                </span>
              </div>
              
              <Magnetic strength={0.3}>
                <button
                  onClick={handleSignOut}
                  type="button"
                  aria-label="Sign out of your account"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-white/[0.04] hover:bg-secondary/10 border border-white/[0.08] hover:border-secondary/25 text-gray-400 hover:text-secondary transition-all duration-300"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </Magnetic>
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-50 transition-colors duration-200"
              >
                Sign In
              </Link>
              <Magnetic strength={0.3}>
                <Link
                  href="/auth/signup"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-[#030712] hover:bg-cyan-400 transition-all duration-300"
                >
                  Get Started
                </Link>
              </Magnetic>
            </>
          )}
        </div>

        {/* MOBILE HAMBURGER */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:text-gray-50 transition-colors"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          type="button"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-white/[0.06] bg-[#0a0f1a]/95 backdrop-blur-xl px-4 py-4 space-y-1" aria-label="Mobile navigation" role="menu">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-gray-50 hover:bg-white/[0.04] transition-colors" role="menuitem">
                Dashboard
              </Link>
              <Link href="/dashboard/discover" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-gray-50 hover:bg-white/[0.04] transition-colors" role="menuitem">
                Discover
              </Link>
              <Link href="/dashboard/memories" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-gray-50 hover:bg-white/[0.04] transition-colors" role="menuitem">
                Memories
              </Link>
              <Link href="/dashboard/security" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-gray-50 hover:bg-white/[0.04] transition-colors" role="menuitem">
                Security
              </Link>
              <div className="pt-2 mt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-400">
                  <span>{user?.full_name}</span>
                  <span className="text-primary">@{user?.username}</span>
                </div>
                <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:bg-secondary/10 transition-colors" role="menuitem" type="button">
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <a href="#features" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-gray-50 hover:bg-white/[0.04] transition-colors" role="menuitem">
                Features
              </a>
              <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-gray-50 hover:bg-white/[0.04] transition-colors" role="menuitem">
                How It Works
              </a>
              <div className="pt-2 mt-2 border-t border-white/[0.06] space-y-1">
                <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-gray-50 hover:bg-white/[0.04] transition-colors" role="menuitem">
                  Sign In
                </Link>
                <Link href="/auth/signup" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-semibold text-primary bg-primary/[0.08] text-center transition-colors" role="menuitem">
                  Get Started
                </Link>
              </div>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
