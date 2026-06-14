"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { 
  Settings, ShieldAlert, Lock, UploadCloud, Users, 
  MessageSquare, Search, Camera, Save, AlertTriangle
} from "lucide-react";

export default function AdminMaintenanceDashboard() {
  const { token } = useAuthStore();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/maintenance", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setSettings(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const saveSettings = async (newSettings: any) => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/maintenance", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = (key: string) => {
    const newVal = !settings[key];
    setSettings({ ...settings, [key]: newVal });
    saveSettings({ [key]: newVal });
  };

  const ToggleSwitch = ({ label, description, icon: Icon, stateKey, danger }: any) => {
    const isEnabled = settings[stateKey] || false;
    return (
      <div className={`p-5 rounded-2xl border ${isEnabled ? (danger ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20') : 'bg-[#1e293b]/30 border-white/[0.05]'} flex items-center justify-between transition-all`}>
        <div className="flex gap-4">
          <div className={`p-3 rounded-xl border ${isEnabled ? (danger ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-blue-500/20 border-blue-500/30 text-blue-400') : 'bg-white/[0.05] border-white/[0.05] text-gray-400'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isEnabled ? (danger ? 'text-red-400' : 'text-blue-400') : 'text-white'}`}>{label}</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md">{description}</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={isEnabled} 
            onChange={() => handleToggle(stateKey)} 
          />
          <div className={`w-14 h-7 rounded-full peer peer-focus:ring-4 transition-all
            ${danger ? 'peer-focus:ring-red-500/30 peer-checked:bg-red-500' : 'peer-focus:ring-blue-500/30 peer-checked:bg-blue-500'}
            bg-gray-700 after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
            after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 
            after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white`}
          ></div>
        </label>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Settings className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Maintenance & Emergency Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Platform Access Controls
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-4xl mx-auto space-y-8">
          {loading ? (
            <div className="text-center py-20">Loading Settings...</div>
          ) : (
            <>
              {/* Critical Core Switch */}
              <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <ShieldAlert className="w-48 h-48 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-6 h-6 text-red-500" /> Platform Maintenance Mode
                </h2>
                <p className="text-sm text-gray-400 mb-8 max-w-2xl">
                  Enabling maintenance mode will completely lock out all non-admin users. 
                  The platform will return a 503 Service Unavailable page.
                  Use this only during critical updates or severe security incidents.
                </p>
                <ToggleSwitch 
                  label="Enable Global Maintenance Mode" 
                  description="Immediately blocks all standard traffic across Web and Mobile PWA." 
                  icon={Lock} 
                  stateKey="maintenance_mode" 
                  danger={true}
                />
              </div>

              {/* Module Switches */}
              <div className="bg-[#1e293b]/30 border border-white/[0.05] p-8 rounded-3xl">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-6 h-6 text-orange-400" /> Granular Emergency Controls
                </h2>
                <p className="text-sm text-gray-400 mb-8 max-w-2xl">
                  Selectively disable specific platform features without bringing down the entire application. 
                  Useful for stopping spam, mitigating DDoS, or throttling backend processing.
                </p>

                <div className="space-y-4">
                  <ToggleSwitch 
                    label="Disable Uploads (Read Only Mode)" 
                    description="Prevents all new photo and video uploads across all communities." 
                    icon={UploadCloud} 
                    stateKey="disable_uploads" 
                    danger={false}
                  />
                  <ToggleSwitch 
                    label="Disable Registrations" 
                    description="Stops new users from signing up. Existing users can still log in." 
                    icon={Users} 
                    stateKey="disable_registrations" 
                    danger={false}
                  />
                  <ToggleSwitch 
                    label="Disable Messaging" 
                    description="Pauses all direct messaging and community chat systems." 
                    icon={MessageSquare} 
                    stateKey="disable_messaging" 
                    danger={false}
                  />
                  <ToggleSwitch 
                    label="Disable Global Search" 
                    description="Turns off Elasticsearch/pgvector queries to reduce database load." 
                    icon={Search} 
                    stateKey="disable_search" 
                    danger={false}
                  />
                  <ToggleSwitch 
                    label="Disable Face Matching AI" 
                    description="Halts background MTCNN extraction and matching to reduce GPU load." 
                    icon={Camera} 
                    stateKey="disable_face_matching" 
                    danger={false}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
