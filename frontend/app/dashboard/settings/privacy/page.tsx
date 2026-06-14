"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Eye, Download, Trash2, Search, Users, RefreshCw, Loader2, AlertTriangle, AlertCircle, Sparkles, Check, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    face_matching_enabled: true,
    public_search_enabled: true,
    community_search_enabled: true,
    allow_face_suggestions: true,
    allow_group_discovery: true,
    allow_relationship_graph: true,
    hide_from_directory: false,
    privacy_profile: "STANDARD",
  });

  // Export State
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchSettings();
    }
  }, [token]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/privacy/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof typeof settings) => {
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    setIsSaving(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/privacy/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [key]: newValue })
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreset = async (preset: string) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/privacy/preset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ preset })
      });
      if (res.ok) {
        fetchSettings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/privacy/export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExportJobId(data.job_id);
        setExportStatus("PROCESSING");
        alert("Data export started. You will receive a notification when it's ready.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFaceData = async () => {
    if (deleteConfirmation !== "DELETE") return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/privacy/delete-face-data`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Face deletion scheduled for 24 hours from now.");
        setShowDeleteModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div>
          <button 
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Privacy & Trust Center</h1>
              <p className="text-gray-400 text-sm mt-1">
                You have complete control over your face data and discoverability.
              </p>
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { id: "STANDARD", label: "Standard", desc: "Balanced discovery", icon: Users },
            { id: "PRIVATE", label: "Private", desc: "Hidden from public", icon: Lock },
            { id: "INVISIBLE", label: "Invisible", desc: "No AI matching", icon: Eye },
            { id: "CUSTOM", label: "Custom", desc: "Your tailored rules", icon: Sparkles }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePreset(p.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                settings.privacy_profile === p.id 
                ? "bg-primary/10 border-primary text-primary" 
                : "bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p.icon className="w-5 h-5" />
                {settings.privacy_profile === p.id && <Check className="w-4 h-4" />}
              </div>
              <div className="font-bold font-display text-white">{p.label}</div>
              <div className="text-xs mt-1">{p.desc}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Face Recognition */}
          <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-display font-bold">Face Recognition</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Enable Face Matching</div>
                  <div className="text-xs text-gray-400 mt-1">Allow FaceSnap AI to find photos containing you. If disabled, future photos will ignore your face embeddings.</div>
                </div>
                <button
                  onClick={() => handleToggle("face_matching_enabled")}
                  className={`w-10 h-6 rounded-full p-1 transition-colors shrink-0 ${settings.face_matching_enabled ? "bg-primary" : "bg-white/20"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${settings.face_matching_enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Allow Face Suggestions</div>
                  <div className="text-xs text-gray-400 mt-1">Allow the AI to suggest your profile to hosts when matching ambiguous photos.</div>
                </div>
                <button
                  onClick={() => handleToggle("allow_face_suggestions")}
                  className={`w-10 h-6 rounded-full p-1 transition-colors shrink-0 ${settings.allow_face_suggestions ? "bg-primary" : "bg-white/20"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${settings.allow_face_suggestions ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Visibility & Discovery */}
          <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Search className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-display font-bold">Visibility & Discovery</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Appear in Public Search</div>
                  <div className="text-xs text-gray-400 mt-1">Allow non-friends to find your profile in global search.</div>
                </div>
                <button
                  onClick={() => handleToggle("public_search_enabled")}
                  className={`w-10 h-6 rounded-full p-1 transition-colors shrink-0 ${settings.public_search_enabled ? "bg-primary" : "bg-white/20"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${settings.public_search_enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Appear in Community Search</div>
                  <div className="text-xs text-gray-400 mt-1">Allow members in shared communities to find you easily.</div>
                </div>
                <button
                  onClick={() => handleToggle("community_search_enabled")}
                  className={`w-10 h-6 rounded-full p-1 transition-colors shrink-0 ${settings.community_search_enabled ? "bg-primary" : "bg-white/20"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${settings.community_search_enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
              
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Hide from Directory</div>
                  <div className="text-xs text-gray-400 mt-1">Completely remove your profile from any public group or directory listings.</div>
                </div>
                <button
                  onClick={() => handleToggle("hide_from_directory")}
                  className={`w-10 h-6 rounded-full p-1 transition-colors shrink-0 ${settings.hide_from_directory ? "bg-primary" : "bg-white/20"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${settings.hide_from_directory ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-12 p-6 rounded-3xl bg-red-500/10 border border-red-500/20 space-y-6">
          <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-display font-bold text-red-500">Danger Zone</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white">Data Export</h3>
              <p className="text-xs text-red-200">Download a ZIP file containing your photos, notifications, matches, and privacy settings.</p>
              <button 
                onClick={handleExportData}
                disabled={exportStatus === "PROCESSING"}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                {exportStatus === "PROCESSING" ? "Exporting..." : "Export My Data"}
              </button>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white">Delete Face Embeddings</h3>
              <p className="text-xs text-red-200">Permanently delete your face encodings from the AI engine. You will stop receiving future matches.</p>
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Face Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-md rounded-2xl glass-panel border border-red-500/30 p-6 relative z-10"
            >
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <AlertTriangle className="w-6 h-6" />
                <h2 className="text-lg font-bold font-display">Delete Face Data?</h2>
              </div>
              <p className="text-sm text-gray-300 mb-6">
                This action is irreversible. All your face encodings will be wiped, and FaceSnap will no longer identify you in uploaded community photos. 
              </p>
              <p className="text-sm text-gray-300 mb-4">
                To proceed, type <strong>DELETE</strong> below:
              </p>
              <input 
                type="text" 
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mb-6 font-mono"
                placeholder="DELETE"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-grow py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-sm font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteFaceData}
                  disabled={deleteConfirmation !== "DELETE" || isDeleting}
                  className="flex-grow py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center justify-center"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Deletion"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
