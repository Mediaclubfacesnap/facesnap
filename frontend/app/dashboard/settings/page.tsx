"use client";

import React, { useState, useEffect } from "react";
import { HardDrive, Bell, Download, Trash2, ShieldCheck, Settings } from "lucide-react";
import { getOfflineMessagesCount, getOfflineUploadsCount, getPWASetting, setPWASetting } from "@/utils/offlineSync";
import { useAuthStore } from "@/store/authStore";

export default function PWASettingsPage() {
  const [cacheSize, setCacheSize] = useState<string>("Calculating...");
  const [messageQueue, setMessageQueue] = useState(0);
  const [uploadQueue, setUploadQueue] = useState(0);
  const [pushStatus, setPushStatus] = useState<"granted" | "denied" | "default">("default");
  
  const { token } = useAuthStore();

  useEffect(() => {
    async function loadStats() {
      // IndexedDB queue sizes
      setMessageQueue(await getOfflineMessagesCount());
      setUploadQueue(await getOfflineUploadsCount());
      
      // Cache Storage size
      if ("storage" in navigator && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          setCacheSize((estimate.usage / 1024 / 1024).toFixed(2) + " MB");
        } else {
          setCacheSize("Unknown");
        }
      }

      // Notification permission
      if ("Notification" in window) {
        setPushStatus(Notification.permission);
      }
    }
    loadStats();
    
    // Polling every 5s just for live feedback
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const subscribePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push notifications not supported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);

      if (permission === "granted") {
        // Fetch VAPID Key from backend
        const res = await fetch("http://localhost:8000/api/v1/pwa/vapid-public-key");
        const { public_key } = await res.json();
        
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key)
        });

        // Send to backend
        const subData = JSON.parse(JSON.stringify(subscription));
        await fetch("http://localhost:8000/api/v1/pwa/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            endpoint: subData.endpoint,
            p256dh: subData.keys.p256dh,
            auth: subData.keys.auth,
            user_agent: navigator.userAgent
          })
        });
        
        alert("Subscribed successfully!");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to subscribe to push notifications");
    }
  };

  const clearCache = async () => {
    if (confirm("Clear all offline caches? You will need internet to reload the app.")) {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
      alert("Caches cleared.");
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-cyan-400" />
        <h1 className="text-3xl font-bold text-white tracking-tight">App Settings</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Push Notifications Card */}
        <div className="bg-[#1e293b]/50 border border-white/[0.05] p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Push Notifications</h3>
                <p className="text-xs text-gray-400">Receive alerts when offline</p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              pushStatus === "granted" ? "bg-green-500/20 text-green-400" :
              pushStatus === "denied" ? "bg-red-500/20 text-red-400" :
              "bg-yellow-500/20 text-yellow-400"
            }`}>
              {pushStatus.toUpperCase()}
            </span>
          </div>
          
          {pushStatus !== "granted" && (
            <button 
              onClick={subscribePush}
              className="w-full mt-2 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-semibold transition-colors"
            >
              Enable Notifications
            </button>
          )}
        </div>

        {/* Offline Queue Card */}
        <div className="bg-[#1e293b]/50 border border-white/[0.05] p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Pending Sync</h3>
                <p className="text-xs text-gray-400">Data waiting for connection</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 mt-4">
            <div className="flex-1 bg-black/20 p-3 rounded-lg border border-white/[0.02]">
              <div className="text-2xl font-bold text-white">{messageQueue}</div>
              <div className="text-xs text-gray-500">Messages</div>
            </div>
            <div className="flex-1 bg-black/20 p-3 rounded-lg border border-white/[0.02]">
              <div className="text-2xl font-bold text-white">{uploadQueue}</div>
              <div className="text-xs text-gray-500">Uploads</div>
            </div>
          </div>
        </div>

        {/* Storage Card */}
        <div className="bg-[#1e293b]/50 border border-white/[0.05] p-6 rounded-2xl backdrop-blur-sm md:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Storage Management</h3>
                <p className="text-xs text-gray-400">Total offline cache: {cacheSize}</p>
              </div>
            </div>
            <button 
              onClick={clearCache}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-semibold transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility to convert Base64 VAPID keys to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
