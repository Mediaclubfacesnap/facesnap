"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/AdminSidebar";
import { 
  Users, Search, Filter, ShieldAlert, LogOut, CheckCircle, 
  Ban, Shield, User, Clock, Activity
} from "lucide-react";

export default function AdminUsersDashboard() {
  const { token } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/operations/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleAction = async (userId: string, action: string, value: string) => {
    try {
      let url = `http://localhost:8000/api/v1/admin/operations/users/${userId}/${action}`;
      let method = "PUT";
      let body = JSON.stringify(action === "role" ? { role: value } : { status: value });

      if (action === "force-logout") {
        method = "POST";
        body = JSON.stringify({});
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body
      });

      if (res.ok) {
        fetchUsers();
      } else {
        alert("Action failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#030712] text-white font-sans">
      <AdminSidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between bg-[#030712]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                User Management Center
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                Identity & Access Governance
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Controls */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search users by name or email..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#1e293b]/50 border border-white/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <button className="px-4 py-2 bg-[#1e293b]/50 border border-white/[0.05] rounded-xl text-sm font-semibold hover:bg-white/[0.05] flex items-center gap-2 transition-all">
              <Filter className="w-4 h-4" /> Filters
            </button>
          </div>

          {/* Table */}
          <div className="bg-[#1e293b]/30 border border-white/[0.05] rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1e293b]/80 border-b border-white/[0.05] text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Activity</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                      <Activity className="w-5 h-5 mx-auto mb-2 animate-spin text-blue-400" />
                      Loading Directory...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No users found.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user: any) => (
                    <tr key={user.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.05] flex items-center justify-center">
                            {user.profile_picture_url ? (
                              <img src={user.profile_picture_url} className="w-full h-full rounded-full object-cover" alt="pfp" />
                            ) : (
                              <User className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-white">{user.full_name}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <select 
                          className="bg-[#0f172a] border border-white/[0.1] text-xs rounded-lg px-2 py-1 text-gray-300 focus:outline-none"
                          value={user.platform_role}
                          onChange={(e) => handleAction(user.id, "role", e.target.value)}
                        >
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </td>
                      <td className="py-4 px-6">
                        {user.locked_until ? (
                          <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold tracking-wider flex w-max items-center gap-1">
                            <Ban className="w-3 h-3" /> SUSPENDED
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold tracking-wider flex w-max items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-xs text-gray-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {user.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                          {user.locked_until ? (
                            <button onClick={() => handleAction(user.id, "status", "active")} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold" title="Unsuspend">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => handleAction(user.id, "status", "suspended")} className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold" title="Suspend">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleAction(user.id, "force-logout", "")} className="p-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 rounded-lg text-xs font-semibold" title="Force Logout">
                            <LogOut className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
