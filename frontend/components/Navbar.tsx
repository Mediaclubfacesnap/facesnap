"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Camera, LogOut, Menu, X } from "lucide-react";
import Magnetic from "./Magnetic";

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    router.push("/");
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
        <Link href="/" className="flex items-center gap-2.5 group" aria-label="FaceSnap home">
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <Camera className="w-4 h-4 text-[#030712]" />
          </div>
          <span className="text-lg font-display font-bold tracking-tight text-gray-50">
            FaceSnap
          </span>
        </Link>

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
