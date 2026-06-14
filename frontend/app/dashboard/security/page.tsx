"use client";

import React, { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldCheck, Key, Laptop, Activity, Lock, Smartphone, History, Eye, X, Fingerprint } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { QRCodeSVG } from "qrcode.react";

export default function SecurityCenterPage() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState("overview");

  const [score, setScore] = useState(50);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [biometrics, setBiometrics] = useState<any>(null);

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [qrCodeUri, setQrCodeUri] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchSessions();
    fetchHistory();
    fetchBiometrics();
    fetchAlerts();
    
    // Simple heuristic for score
    let s = 50;
    if (twoFactorEnabled) s += 30;
    if (biometrics?.face_matching_enabled) s += 10;
    setScore(s);
  }, [token, twoFactorEnabled, biometrics]);

  const fetchSessions = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/security/sessions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {}
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/security/login-history", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLoginHistory(data.login_history || []);
      }
    } catch (e) {}
  };

  const fetchBiometrics = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/security/biometric-status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBiometrics(data);
      }
    } catch (e) {}
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/security/alerts", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (e) {}
  };

  const revokeSession = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/security/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSessions();
        alert("Session revoked.");
      }
    } catch (e) {}
  };

  const setup2FA = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/security/2fa/setup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQrCodeUri(data.otpauth_uri);
      }
    } catch (e) {}
  };

  const verify2FA = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/security/2fa/verify", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ code: verificationCode })
      });
      if (res.ok) {
        const data = await res.json();
        setTwoFactorEnabled(true);
        setBackupCodes(data.backup_codes);
        alert("2FA Enabled Successfully!");
        setQrCodeUri("");
      } else {
        alert("Invalid Code");
      }
    } catch (e) {}
  };

  const disable2FA = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/security/2fa/disable", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ password: disablePassword })
      });
      if (res.ok) {
        setTwoFactorEnabled(false);
        alert("2FA Disabled.");
        setDisablePassword("");
      } else {
        alert("Incorrect password.");
      }
    } catch (e) {}
  };

  const changePassword = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/security/change-password", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      if (res.ok) {
        alert("Password updated.");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        alert("Failed to update password.");
      }
    } catch (e) {}
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            Security Center
          </h1>
          <p className="text-gray-400 mt-1">Manage your account security, active devices, and privacy settings.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-[#1e293b]/80 p-4 rounded-2xl border border-white/5">
          <div>
            <div className="text-sm text-gray-400 font-medium">Security Score</div>
            <div className="text-2xl font-bold text-white flex items-baseline gap-1">
              {score} <span className="text-sm text-gray-500 font-normal">/ 100</span>
            </div>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 flex items-center justify-center relative">
            <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-emerald-500"
                strokeDasharray={`${score}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
            </svg>
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 mb-6 gap-2 hide-scrollbar">
        {['overview', 'devices', '2fa', 'password', 'biometrics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === tab 
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {(activeTab === 'overview' || activeTab === '2fa') && (
            <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Two-Factor Authentication</h2>
                  <p className="text-sm text-gray-400">Protect your account with an extra layer of security.</p>
                </div>
              </div>

              {!twoFactorEnabled ? (
                <div className="space-y-4">
                  {!qrCodeUri ? (
                    <button onClick={setup2FA} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors">
                      Setup 2FA Now
                    </button>
                  ) : (
                    <div className="space-y-4 animate-in zoom-in-95 duration-300">
                      <p className="text-sm text-gray-300">Scan this QR code with your Authenticator App (Google, Authy).</p>
                      <div className="bg-white p-4 rounded-xl inline-block">
                        <QRCodeSVG value={qrCodeUri} size={200} />
                      </div>
                      <div className="flex items-center gap-2 max-w-sm">
                        <input 
                          type="text" 
                          placeholder="Enter 6-digit code" 
                          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                          value={verificationCode}
                          onChange={e => setVerificationCode(e.target.value)}
                        />
                        <button onClick={verify2FA} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium">
                          Verify
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-3 rounded-xl">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="font-medium">2FA is actively protecting your account.</span>
                  </div>
                  
                  {backupCodes.length > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                      <p className="text-sm text-orange-400 font-medium mb-2">Save these recovery codes! They will not be shown again.</p>
                      <div className="grid grid-cols-2 gap-2 text-white font-mono text-sm">
                        {backupCodes.map((code, idx) => (
                          <div key={idx} className="bg-black/40 px-3 py-1 rounded border border-white/5">{code.substring(0, 8)}...</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-sm text-gray-400 mb-2">To disable 2FA, enter your password.</p>
                    <div className="flex items-center gap-2 max-w-sm">
                      <input 
                        type="password" 
                        placeholder="Current password" 
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white"
                        value={disablePassword}
                        onChange={e => setDisablePassword(e.target.value)}
                      />
                      <button onClick={disable2FA} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl font-medium">
                        Disable 2FA
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {(activeTab === 'overview' || activeTab === 'password') && (
            <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Key className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Password Security</h2>
                  <p className="text-sm text-gray-400">Ensure you use a strong, unique password.</p>
                </div>
              </div>

              <div className="space-y-4 max-w-sm">
                <input 
                  type="password" 
                  placeholder="Current Password" 
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
                <input 
                  type="password" 
                  placeholder="New Password (min 8 chars)" 
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <button 
                  onClick={changePassword}
                  className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
                >
                  Update Password
                </button>
              </div>
            </div>
          )}

          {(activeTab === 'overview' || activeTab === 'devices') && (
            <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Laptop className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Active Sessions</h2>
                  <p className="text-sm text-gray-400">Manage devices currently logged into your account.</p>
                </div>
              </div>

              <div className="space-y-3">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-4">
                      {s.browser?.includes("Safari") ? <Smartphone className="w-6 h-6 text-gray-400" /> : <Laptop className="w-6 h-6 text-gray-400" />}
                      <div>
                        <div className="text-white font-medium flex items-center gap-2">
                          {s.device_name || "Unknown Device"}
                          {s.is_current && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Current</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {s.city}, {s.country} • IP: {s.ip_address} • Active: {new Date(s.last_active).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {!s.is_current && (
                      <button 
                        onClick={() => revokeSession(s.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeTab === 'biometrics') && biometrics && (
            <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Biometric Security</h2>
                  <p className="text-sm text-gray-400">Overview of your face embeddings and identity data.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 border border-white/5 rounded-2xl p-4">
                  <div className="text-sm text-gray-400 mb-1">Face Matching</div>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    {biometrics.face_matching_enabled ? "Enabled" : "Disabled"}
                    <span className={`w-2 h-2 rounded-full ${biometrics.face_matching_enabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </div>
                </div>
                <div className="bg-black/20 border border-white/5 rounded-2xl p-4">
                  <div className="text-sm text-gray-400 mb-1">Embeddings Stored</div>
                  <div className="text-lg font-bold text-white">{biometrics.embeddings_count}</div>
                </div>
                <div className="bg-black/20 border border-white/5 rounded-2xl p-4 col-span-2">
                  <div className="text-sm text-gray-400 mb-1">Last Liveness Verification</div>
                  <div className="text-white">{new Date(biometrics.last_verification).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Area */}
        <div className="space-y-6">
          
          {/* Security Alerts */}
          <div className="bg-[#1e293b]/50 border border-white/5 rounded-3xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-rose-400" />
              Security Alerts
            </h3>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <p className="text-sm text-gray-500">No recent security alerts.</p>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="mt-0.5">
                      {a.severity === 'CRITICAL' ? <ShieldAlert className="w-4 h-4 text-red-500" /> : <Lock className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div>
                      <div className="text-white">{a.message}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Login History */}
          <div className="bg-[#1e293b]/50 border border-white/5 rounded-3xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-gray-400" />
              Login History
            </h3>
            <div className="space-y-4">
              {loginHistory.slice(0, 5).map((l, i) => (
                <div key={i} className="flex gap-3 text-sm border-l-2 border-white/10 pl-3">
                  <div>
                    <div className="text-white flex items-center gap-2">
                      {l.browser} on {l.os}
                      {!l.success && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase">Failed</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{l.city}, {l.country} • {new Date(l.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
