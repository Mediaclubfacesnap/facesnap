"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Bell, Mail, Smartphone, Clock, Shield, Users, Camera, Activity, Save } from "lucide-react";

interface NotificationPreferences {
  face_matches_enabled: boolean;
  community_enabled: boolean;
  social_enabled: boolean;
  achievement_enabled: boolean;
  system_enabled: boolean;
  security_enabled: boolean;
  event_enabled: boolean;
  message_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  digest_enabled: boolean;
  digest_frequency: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuthStore();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchPreferences();
  }, [isAuthenticated]);

  const fetchPreferences = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/preferences`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPrefs(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
  };

  const handleSave = async () => {
    if (!prefs) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/notifications/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(prefs)
      });
      if (res.ok) {
        setSaveMessage("Settings saved successfully.");
      } else {
        setSaveMessage("Failed to save settings.");
      }
    } catch (err) {
      setSaveMessage("Error saving settings.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  if (isLoading || !prefs) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-gray-50 flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" />
          Notification Settings
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Manage how and when you receive notifications from FaceSnap.
        </p>
      </div>

      <div className="space-y-6">
        {/* Delivery Channels */}
        <div className="p-6 rounded-xl glass-panel border border-white/[0.06]">
          <h2 className="text-lg font-semibold text-gray-50 flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-secondary" />
            Delivery Channels
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-gray-200">Push Notifications</span>
                <span className="block text-xs text-gray-400">Receive notifications on your device.</span>
              </div>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={prefs.push_enabled} onChange={() => handleToggle("push_enabled")} />
                <div className={`w-11 h-6 rounded-full transition-colors ${prefs.push_enabled ? "bg-primary" : "bg-white/[0.08]"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.push_enabled ? "left-6" : "left-1"}`} />
                </div>
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-gray-200">Email Notifications</span>
                <span className="block text-xs text-gray-400">Receive important updates via email.</span>
              </div>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={prefs.email_enabled} onChange={() => handleToggle("email_enabled")} />
                <div className={`w-11 h-6 rounded-full transition-colors ${prefs.email_enabled ? "bg-primary" : "bg-white/[0.08]"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.email_enabled ? "left-6" : "left-1"}`} />
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Categories */}
        <div className="p-6 rounded-xl glass-panel border border-white/[0.06]">
          <h2 className="text-lg font-semibold text-gray-50 flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-tertiary" />
            Categories
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-gray-200">Face Matches</span>
                <span className="block text-xs text-gray-400">When we find a new photo containing your face.</span>
              </div>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={prefs.face_matches_enabled} onChange={() => handleToggle("face_matches_enabled")} />
                <div className={`w-11 h-6 rounded-full transition-colors ${prefs.face_matches_enabled ? "bg-primary" : "bg-white/[0.08]"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.face_matches_enabled ? "left-6" : "left-1"}`} />
                </div>
              </div>
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-gray-200">Community Updates</span>
                <span className="block text-xs text-gray-400">Announcements and new events in your groups.</span>
              </div>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={prefs.community_enabled} onChange={() => handleToggle("community_enabled")} />
                <div className={`w-11 h-6 rounded-full transition-colors ${prefs.community_enabled ? "bg-primary" : "bg-white/[0.08]"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.community_enabled ? "left-6" : "left-1"}`} />
                </div>
              </div>
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-gray-200">Event Notifications</span>
                <span className="block text-xs text-gray-400">Reminders for events you've joined.</span>
              </div>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={prefs.event_enabled} onChange={() => handleToggle("event_enabled")} />
                <div className={`w-11 h-6 rounded-full transition-colors ${prefs.event_enabled ? "bg-primary" : "bg-white/[0.08]"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.event_enabled ? "left-6" : "left-1"}`} />
                </div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-gray-200">System & Security</span>
                <span className="block text-xs text-gray-400">Critical account updates (cannot be completely disabled).</span>
              </div>
              <div className="relative opacity-50 cursor-not-allowed">
                <div className="w-11 h-6 rounded-full bg-primary transition-colors">
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white left-6" />
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Quiet Hours & Digest */}
        <div className="p-6 rounded-xl glass-panel border border-white/[0.06]">
          <h2 className="text-lg font-semibold text-gray-50 flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-500" />
            Scheduling & Digests
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div>
                  <span className="block text-sm font-medium text-gray-200">Quiet Hours</span>
                  <span className="block text-xs text-gray-400">Pause non-critical notifications during these hours.</span>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={prefs.quiet_hours_enabled} onChange={() => handleToggle("quiet_hours_enabled")} />
                  <div className={`w-11 h-6 rounded-full transition-colors ${prefs.quiet_hours_enabled ? "bg-primary" : "bg-white/[0.08]"}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.quiet_hours_enabled ? "left-6" : "left-1"}`} />
                  </div>
                </div>
              </label>
              
              {prefs.quiet_hours_enabled && (
                <div className="flex items-center gap-4 pl-4 border-l-2 border-white/[0.08]">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Time</label>
                    <input 
                      type="time" 
                      value={prefs.quiet_hours_start} 
                      onChange={(e) => setPrefs({...prefs, quiet_hours_start: e.target.value})}
                      className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-sm text-gray-200 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Time</label>
                    <input 
                      type="time" 
                      value={prefs.quiet_hours_end} 
                      onChange={(e) => setPrefs({...prefs, quiet_hours_end: e.target.value})}
                      className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-sm text-gray-200 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/[0.06]">
              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div>
                  <span className="block text-sm font-medium text-gray-200">Periodic Digest</span>
                  <span className="block text-xs text-gray-400">Receive a summary of all missed activity.</span>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={prefs.digest_enabled} onChange={() => handleToggle("digest_enabled")} />
                  <div className={`w-11 h-6 rounded-full transition-colors ${prefs.digest_enabled ? "bg-primary" : "bg-white/[0.08]"}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.digest_enabled ? "left-6" : "left-1"}`} />
                  </div>
                </div>
              </label>

              {prefs.digest_enabled && (
                <div className="pl-4 border-l-2 border-white/[0.08]">
                  <label className="block text-xs text-gray-400 mb-1">Digest Frequency</label>
                  <select 
                    value={prefs.digest_frequency} 
                    onChange={(e) => setPrefs({...prefs, digest_frequency: e.target.value})}
                    className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-sm text-gray-200 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center gap-4 mt-8">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-[#030712] text-sm font-semibold hover:bg-cyan-400 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Preferences
          </button>
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes("Error") || saveMessage.includes("Failed") ? "text-red-400" : "text-emerald-400"}`}>
              {saveMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
