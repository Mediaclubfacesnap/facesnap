"use client";

import React, { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already installed or dismissed
    const isDismissed = localStorage.getItem("facesnap_pwa_dismissed");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone || isDismissed) {
      return;
    }

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }
    
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("facesnap_pwa_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-[#1e293b] border border-cyan-500/30 rounded-xl p-4 shadow-2xl shadow-cyan-900/20 z-50 flex gap-4 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex-1">
        <h3 className="font-semibold text-white text-sm">Install FaceSnap App</h3>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          Add FaceSnap to your home screen for a faster, full-screen native experience with offline support and push notifications.
        </p>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleInstall}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-[#030712] px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Install App
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-500 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
