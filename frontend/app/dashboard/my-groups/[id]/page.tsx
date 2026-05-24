"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Users, Calendar, MapPin, Sparkles, Loader2, 
  ArrowLeft, Compass, CheckCircle2, Activity, Image as ImageIcon,
  Settings, UserCheck, Trash2, Camera, UploadCloud, 
  X, ChevronRight, Check, Share2, Link2, Bell, Home, LogOut,
  Search, Shield, Clock, Eye, ScanFace, BarChart3, Filter, RefreshCw
} from "lucide-react";

interface Community {
  id: string;
  title: string;
  description: string;
  category: string;
  logo_url?: string | null;
  banner_url?: string | null;
  creator_id: string;
}

interface Event {
  id: string;
  community_id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  status: string;
  banner_url?: string | null;
  cover_url?: string | null;
}

interface ContributorRole {
  id: string;
  role: string;
  user: {
    id: string;
    full_name: string;
    username: string;
    email: string;
    created_at: string;
  };
}

interface ContributorRequest {
  id: string;
  community_id: string;
  user_id: string;
  request_type: string;
  status: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    username: string;
    email: string;
    created_at: string;
  };
}

interface DBInvitation {
  id: string;
  status: string;
  created_at: string;
  invitee: {
    id: string;
    username: string;
    full_name: string;
  };
}

interface RecognitionRecord {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  liveness_score: number;
  matched_photos_count: number;
  average_confidence: number;
  processing_time_ms: number;
  ip_address?: string;
  device_info?: string;
  created_at: string;
  user: { id: string; username: string; full_name: string; email: string; avatar_url?: string; created_at: string; };
  event?: { id: string; title: string; community_id: string; description: string; location: string; date: string; status: string; banner_url?: string; cover_url?: string; creator_id: string; created_at: string; } | null;
}

interface RecognitionStats {
  total_searches: number;
  total_photos_found: number;
  failed_searches: number;
  most_active_username: string | null;
  storage_used_bytes?: number;
}

export default function MyGroupWorkspace() {
  const params = useParams();
  const router = useRouter();
  const { token, user, isAuthenticated, logout } = useAuthStore();
  const communityId = params.id as string;

  // Metadata & Navigation States
  const [community, setCommunity] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [roles, setRoles] = useState<ContributorRole[]>([]);
  const [requests, setRequests] = useState<ContributorRequest[]>([]);
  const [invitations, setInvitations] = useState<DBInvitation[]>([]);
  const [myRoles, setMyRoles] = useState<Record<string, string>>({});
  
  // Current user's role: "host" | "admin" | "contributor"
  const [currentUserRole, setCurrentUserRole] = useState<string>(""); 
  const [activeTab, setActiveTab] = useState<"events" | "gallery" | "requests" | "members" | "settings" | "analytics" | "recognition">("events");
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Recognition History States
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionRecord[]>([]);
  const [recognitionStats, setRecognitionStats] = useState<RecognitionStats | null>(null);
  const [recognitionLoading, setRecognitionLoading] = useState(false);
  const [recognitionSearch, setRecognitionSearch] = useState("");
  const [recognitionFilter, setRecognitionFilter] = useState<string>("all");
  const [selectedRecognition, setSelectedRecognition] = useState<RecognitionRecord | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Selected Event context inside the Events Tab (for uploading)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Create Event Modal State
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventLoc, setEventLoc] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventCover, setEventCover] = useState<string | null>(null);
  const [eventBannerFile, setEventBannerFile] = useState<File | null>(null);
  const [eventBannerPreview, setEventBannerPreview] = useState<string | null>(null);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [eventErrorMsg, setEventErrorMsg] = useState("");

  // Invite Members Modal State
  const [isOpenInviteModal, setIsOpenInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");

  // Role Checks
  const isHost = currentUserRole === "host";
  const isAdmin = currentUserRole === "admin";
  const isContributor = currentUserRole === "contributor";
  const isElevated = ["host", "admin", "contributor"].includes(currentUserRole);

  const canManageEcosystem = ["host", "admin"].includes(currentUserRole);

  // ─── Recognition History Helpers ───────────────────────────
  const fetchRecognitionData = async (silent = false) => {
    if (!token) return;
    if (!silent) setRecognitionLoading(true);
    try {
      const [historyRes, statsRes] = await Promise.all([
        fetch(`http://localhost:8000/api/v1/verification/history/${communityId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:8000/api/v1/verification/stats/${communityId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (historyRes.ok) {
        const data = await historyRes.json();
        setRecognitionHistory(data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setRecognitionStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch recognition data:", err);
    } finally {
      if (!silent) setRecognitionLoading(false);
    }
  };

  const getTimeAgo = (dateStr: string): string => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = 1;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const filteredRecognition = recognitionHistory.filter((rec) => {
    // Search filter
    const q = recognitionSearch.toLowerCase();
    const matchesSearch = !q || 
      rec.user.username.toLowerCase().includes(q) ||
      rec.user.full_name.toLowerCase().includes(q) ||
      rec.user.id.toLowerCase().includes(q) ||
      (rec.event?.title || "").toLowerCase().includes(q);

    // Status filter
    let matchesFilter = true;
    if (recognitionFilter === "verified") matchesFilter = rec.status === "verified" && rec.matched_photos_count > 0;
    else if (recognitionFilter === "failed") matchesFilter = rec.status === "failed";
    else if (recognitionFilter === "no_match") matchesFilter = rec.status === "verified" && rec.matched_photos_count === 0;

    return matchesSearch && matchesFilter;
  });

  const defaultEventCovers: Record<string, string> = {
    Technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop",
    Education: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=600&auto=format&fit=crop",
    Photography: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=600&auto=format&fit=crop",
    Music: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
    Sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop"
  };

  const activeEventCover = eventBannerPreview || eventCover || defaultEventCovers[community?.category || "Technology"] || defaultEventCovers.Technology;

  const [isUpdatingCommBanner, setIsUpdatingCommBanner] = useState(false);
  const [isUpdatingEventBanner, setIsUpdatingEventBanner] = useState(false);

  const handleUploadCommunityBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUpdatingCommBanner(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("http://localhost:8000/api/v1/uploads/banner", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.detail || "Banner upload failed.");
      }

      const { banner_url } = await uploadRes.json();

      const updateRes = await fetch(`http://localhost:8000/api/v1/communities/${communityId}/banner`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ banner_url }),
      });

      if (!updateRes.ok) {
        const data = await updateRes.json();
        throw new Error(data.detail || "Failed to update community banner.");
      }

      const updatedComm = await updateRes.json();
      setCommunity(updatedComm);
      setCommunities((prev) => prev.map((c) => c.id === communityId ? updatedComm : c));
    } catch (err: any) {
      alert(err.message || "Failed to update community banner.");
    } finally {
      setIsUpdatingCommBanner(false);
    }
  };

  const handleUploadEventBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEvent) return;

    setIsUpdatingEventBanner(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("http://localhost:8000/api/v1/uploads/banner", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.detail || "Banner upload failed.");
      }

      const { banner_url } = await uploadRes.json();

      const updateRes = await fetch(`http://localhost:8000/api/v1/events/${selectedEvent.id}/banner`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ banner_url }),
      });

      if (!updateRes.ok) {
        const data = await updateRes.json();
        throw new Error(data.detail || "Failed to update event banner.");
      }

      const updatedEvent = await updateRes.json();
      setSelectedEvent(updatedEvent);
      setEvents((prev) => prev.map((ev) => ev.id === selectedEvent.id ? updatedEvent : ev));
    } catch (err: any) {
      alert(err.message || "Failed to update event banner.");
    } finally {
      setIsUpdatingEventBanner(false);
    }
  };

  const handleSignOut = () => {
    logout();
    router.push("/");
  };

  const fetchData = async () => {
    try {
      // 1. Fetch all communities to populate sidebar groups list
      const allCommRes = await fetch("http://localhost:8000/api/v1/communities/");
      if (allCommRes.ok) {
        const allCommData = await allCommRes.json();
        setCommunities(allCommData);
      }

      // 2. Fetch my roles map
      const myRolesRes = await fetch("http://localhost:8000/api/v1/communities/my-roles", {
        headers: { Authorization: `Bearer ${token}` }
      });
      let verifiedRole = "";
      if (myRolesRes.ok) {
        const rolesMap = await myRolesRes.json();
        setMyRoles(rolesMap);
        verifiedRole = rolesMap[communityId] || "";
        setCurrentUserRole(verifiedRole);
      }

      // 3. Block access immediately if not HOST, ADMIN, or CONTRIBUTOR
      if (!["host", "admin", "contributor"].includes(verifiedRole)) {
        alert("Unauthorized workspace access. HOST, ADMIN, or CONTRIBUTOR permissions are required.");
        router.push("/dashboard");
        return;
      }

      // 4. Fetch selected community metadata
      const commRes = await fetch(`http://localhost:8000/api/v1/communities/${communityId}`);
      if (!commRes.ok) throw new Error("Community workspace not found.");
      const commData = await commRes.json();
      setCommunity(commData);

      // 5. Fetch community collaborator roles list
      const rolesRes = await fetch(`http://localhost:8000/api/v1/communities/${communityId}/roles`);
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }

      // 6. Fetch events
      const eventsRes = await fetch(`http://localhost:8000/api/v1/events/community/${communityId}`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }

      // 7. Fetch Requests & Invitations if Host/Admin
      const isPrivileged = ["host", "admin"].includes(verifiedRole);
      if (isPrivileged) {
        const reqsRes = await fetch(`http://localhost:8000/api/v1/communities/${communityId}/requests`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (reqsRes.ok) {
          const reqsData = await reqsRes.json();
          setRequests(reqsData);
        }

        const invitesRes = await fetch(`http://localhost:8000/api/v1/communities/${communityId}/invitations`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (invitesRes.ok) {
          const invitesData = await invitesRes.json();
          setInvitations(invitesData);
        }

        // 8. Fetch recognition stats for analytics
        const statsRes = await fetch(`http://localhost:8000/api/v1/verification/stats/${communityId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setRecognitionStats(statsData);
        }
      }
    } catch (err) {
      console.error("Error synchronizing workspace context:", err);
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchData();
  }, [communityId, isAuthenticated]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEvent(true);
    setEventErrorMsg("");

    try {
      let finalBannerUrl = activeEventCover;

      if (eventBannerFile) {
        const formData = new FormData();
        formData.append("file", eventBannerFile);

        const uploadRes = await fetch("http://localhost:8000/api/v1/uploads/banner", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          throw new Error(data.detail || "Failed to upload custom event banner to storage.");
        }

        const { banner_url } = await uploadRes.json();
        finalBannerUrl = banner_url;
      }

      const response = await fetch(`http://localhost:8000/api/v1/events/${communityId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: eventTitle,
          description: eventDesc,
          location: eventLoc,
          date: eventDate,
          cover_url: finalBannerUrl
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to deploy event.");

      setIsOpenModal(false);
      setEventTitle("");
      setEventDesc("");
      setEventLoc("");
      setEventDate("");
      setEventCover(null);
      setEventBannerFile(null);
      setEventBannerPreview(null);
      setEvents((prev) => [data, ...prev]);
    } catch (err: any) {
      setEventErrorMsg(err.message || "Failed to deploy event container.");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleUploadImages = async () => {
    if (selectedFiles.length === 0 || !selectedEvent) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadSuccess(false);

    const totalFiles = selectedFiles.length;
    let completedFiles = 0;
    let failedFiles = 0;
    const failedDetails: string[] = [];

    // Use a concurrency pool of size 3 to maximize throughput and avoid browser connections limits
    const concurrencyLimit = 3;
    const filesQueue = [...selectedFiles];

    const uploadWorker = async () => {
      while (filesQueue.length > 0) {
        const file = filesQueue.shift();
        if (!file) continue;

        try {
          const formData = new FormData();
          formData.append("files", file);

          const res = await fetch(`http://localhost:8000/api/v1/uploads/${selectedEvent.id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || `Upload failed for ${file.name}`);
          }

          completedFiles++;
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          failedFiles++;
          failedDetails.push(err.message || `Upload failed for ${file.name}`);
        } finally {
          const progressPercent = Math.round(((completedFiles + failedFiles) / totalFiles) * 100);
          setUploadProgress(progressPercent);
        }
      }
    };

    try {
      // Launch parallel workers
      const workers = Array(Math.min(concurrencyLimit, totalFiles))
        .fill(null)
        .map(() => uploadWorker());

      await Promise.all(workers);

      if (failedFiles > 0) {
        if (completedFiles === 0) {
          throw new Error(failedDetails[0] || "All image uploads in the folder failed.");
        } else {
          setUploadError(`Batch completed: ${completedFiles} succeeded, ${failedFiles} skipped/failed. (${failedDetails.slice(0, 2).join(", ")}${failedFiles > 2 ? "..." : ""})`);
        }
      } else {
        setUploadProgress(100);
        setUploadSuccess(true);
        setSelectedFiles([]);
      }
    } catch (err: any) {
      setUploadError(err.message || "Parallel upload pipeline encountered a fatal error.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReviewRequest = async (requestId: string, status: "approved" | "rejected") => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/communities/${communityId}/requests/${requestId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to review access request:", err);
    }
  };

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/communities/${communityId}/members/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (response.ok) {
        await fetchData();
      } else {
        const data = await response.json();
        alert(data.detail || "Unable to update member role.");
      }
    } catch (err) {
      console.error("Failed to update member role:", err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member from the group workspace?")) return;
    try {
      const response = await fetch(`http://localhost:8000/api/v1/communities/${communityId}/members/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        await fetchData();
      } else {
        const data = await response.json();
        alert(data.detail || "Unable to remove member.");
      }
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  const handleDeleteCommunity = async () => {
    if (!token) return;
    
    const confirmDeleteFirst = window.confirm(
      "CAUTION: Deleting this workspace group is irreversible. " +
      "It will permanently destroy all events, uploaded photos, collaborator records, and recognition history. " +
      "Are you absolutely sure you want to proceed?"
    );
    if (!confirmDeleteFirst) return;

    const confirmDeleteSecond = window.confirm(
      "WARNING: This CANNOT be undone under any circumstances. " +
      "Are you 100% sure you wish to permanently purge this group workspace?"
    );
    if (!confirmDeleteSecond) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/communities/${communityId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        alert("Community workspace group successfully deleted.");
        router.push("/dashboard");
      } else {
        const data = await response.json();
        alert(data.detail || "Failed to delete community workspace.");
      }
    } catch (err) {
      console.error("Error deleting community:", err);
      alert("An unexpected error occurred while deleting the workspace.");
    }
  };

  // Real-time user invite search
  useEffect(() => {
    if (!inviteSearchQuery.trim()) {
      setSearchedUsers([]);
      return;
    }

    const searchUsersDb = async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`http://localhost:8000/api/v1/communities/search-users?q=${inviteSearchQuery}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSearchedUsers(data);
        }
      } catch (err) {
        console.error("User search failed:", err);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      searchUsersDb();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [inviteSearchQuery, token]);

  // Poll for new face recognition sessions and stats in real-time when the recognition or analytics tab is active
  useEffect(() => {
    const isPollingTab = activeTab === "recognition" || activeTab === "analytics";
    if (!isPollingTab || !canManageEcosystem || !token) return;

    // Fetch immediately: show loading spinner if we have no history/stats yet, otherwise fetch silently
    const showLoader = activeTab === "recognition" 
      ? recognitionHistory.length === 0 
      : !recognitionStats;
      
    fetchRecognitionData(!showLoader);

    // Background poll every 8 seconds silently
    const intervalId = setInterval(() => {
      fetchRecognitionData(true);
    }, 8000);

    return () => clearInterval(intervalId);
  }, [activeTab, canManageEcosystem, token, communityId]);

  const handleSendInvitation = async (username: string) => {
    setInviteSuccessMsg("");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/communities/${communityId}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ invitee_username: username })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteSuccessMsg(`Invitation successfully dispatched to @${username}!`);
        await fetchData();
      } else {
        alert(data.detail || "Unable to dispatch invitation.");
      }
    } catch (err) {
      console.error("Invitation dispatch failed:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-white/[0.04] border-white/[0.12] text-gray-400",
      uploading: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      processing: "bg-primary/10 border-primary/20 text-primary",
      live: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      archived: "bg-secondaryText/10 border-secondaryText/20 text-gray-400",
    };
    return styles[status] || styles.draft;
  };

  const myGroups = communities.filter((c) => myRoles[c.id]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#030712]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">
      
      {/* ====== LEFT SIDEBAR LAYOUT ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-secondary/20 to-primary/20 border border-white/[0.08]">
              <Camera className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider text-white">FaceSnap</span>
              <span className="block text-[7px] tracking-[0.2em] text-secondary font-bold uppercase -mt-0.5">
                AI Workspace OS
              </span>
            </div>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/discover")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Compass className="w-4 h-4" />
            <span>Discover</span>
          </button>
        </nav>

        {/* MY GROUPS PRIVATE SIDEBAR LIST */}
        <div className="px-3 mt-2">
          <div className="px-3 py-2">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              My Workspaces
            </span>
          </div>
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {myGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => router.push(`/dashboard/my-groups/${group.id}`)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-200 group ${
                  group.id === communityId
                    ? "bg-white/[0.04] text-white border border-white/[0.08]"
                    : "text-gray-300 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/[0.08] flex items-center justify-center text-[8px] font-bold text-primary flex-shrink-0">
                  {group.title.charAt(0)}
                </div>
                <span className="truncate">{group.title}</span>
                <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* User Pill card bottom */}
        <div className="mt-auto px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/[0.08] flex items-center justify-center text-xs font-bold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="text-xs font-bold text-white block truncate">{user?.full_name}</span>
              <span className="text-[10px] text-gray-400 block truncate">@{user?.username}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-secondary/10 text-gray-400 hover:text-secondary transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ====== MAIN CONTENT RIGHT AREA ====== */}
      <main className="flex-grow overflow-y-auto min-h-screen flex flex-col justify-between">
        
        {/* Header toolbar */}
        <div className="sticky top-0 z-10 w-full glass-panel border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold text-primary uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              {community?.category || "Technology"}
            </span>
            <h1 className="text-lg font-extrabold text-white tracking-tight font-display truncate max-w-[280px]">
              {community?.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-extrabold tracking-widest text-primary border border-primary/25 bg-primary/10 px-3 py-1 rounded-full uppercase">
              Role Clearance: {currentUserRole}
            </span>
            {isElevated && activeTab === "events" && !selectedEvent && (
              <button
                onClick={() => setIsOpenModal(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(0,229,255,0.1)] hover:scale-105"
              >
                Create Event
              </button>
            )}
          </div>
        </div>

        {/* Content body container */}
        <div className="flex-grow max-w-6xl w-full mx-auto px-8 py-8 flex flex-col">
          
          {isLoading || !community ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 flex-grow w-full">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <span className="text-xs text-gray-400 tracking-widest uppercase font-bold">Synchronizing workspace components...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-6 flex-grow">
              
              {/* Community Banner Widescreen display */}
              <div className="relative h-32 md:h-40 rounded-2xl overflow-hidden border border-white/[0.06] group shadow-xl transition-all duration-300">
                {community?.banner_url ? (
                  <img src={community.banner_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                    <span className="text-xs text-gray-400 font-medium tracking-wider uppercase">No community banner deployed</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent"></div>
                <div className="absolute bottom-4 left-6 flex items-end gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/[0.08] flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                    {community?.title?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight font-display">{community?.title}</h2>
                    <p className="text-[10px] text-gray-400 leading-none mt-1 uppercase tracking-widest font-semibold">AI Workspace Ecosystem ({community?.category})</p>
                  </div>
                </div>

                {/* Change Community Banner Button Overlay */}
                {canManageEcosystem && (
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => document.getElementById("community-banner-upload-input")?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/[0.08] hover:border-primary/40 text-[10px] font-bold text-white transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-primary" />
                      <span>{isUpdatingCommBanner ? "Updating..." : "Change Banner"}</span>
                    </button>
                    <input
                      id="community-banner-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={handleUploadCommunityBanner}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
              
              {/* TAB SELECTORS (HORIZONTALLY SCROLLABLE UTILITY) */}
              <div className="w-full border-b border-white/[0.06] pb-1 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1 flex-nowrap min-w-max">
                  
                  <button
                    onClick={() => { setSelectedEvent(null); setActiveTab("events"); }}
                    className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                      activeTab === "events" ? "text-primary" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span>Events Workspace</span>
                    {activeTab === "events" && (
                      <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_#06b6d4]"></motion.div>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab("gallery")}
                    className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                      activeTab === "gallery" ? "text-primary" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span>Private Gallery</span>
                    {activeTab === "gallery" && (
                      <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary"></motion.div>
                    )}
                  </button>

                  {canManageEcosystem && (
                    <>
                      <button
                        onClick={() => setActiveTab("requests")}
                        className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                          activeTab === "requests" ? "text-primary" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>Access Requests</span>
                        {activeTab === "requests" && (
                          <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary"></motion.div>
                        )}
                      </button>

                      <button
                        onClick={() => setActiveTab("members")}
                        className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                          activeTab === "members" ? "text-primary" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>Members Directory</span>
                        {activeTab === "members" && (
                          <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary"></motion.div>
                        )}
                      </button>

                      <button
                        onClick={() => setActiveTab("analytics")}
                        className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                          activeTab === "analytics" ? "text-primary" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>Workspace Analytics</span>
                        {activeTab === "analytics" && (
                          <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary"></motion.div>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab("recognition");
                        }}
                        className={`px-4 py-2.5 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                          activeTab === "recognition" ? "text-primary" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <ScanFace className="w-3 h-3" />
                        <span>Recognition History</span>
                        {activeTab === "recognition" && (
                          <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_#06b6d4]"></motion.div>
                        )}
                      </button>

                      <button
                        onClick={() => setActiveTab("settings")}
                        className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                          activeTab === "settings" ? "text-primary" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>Settings Panel</span>
                        {activeTab === "settings" && (
                          <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary"></motion.div>
                        )}
                      </button>
                    </>
                  )}

                </div>
              </div>

              {/* TAB CONTENTS */}
              <div className="flex-grow flex flex-col">
                
                {/* 1. EVENTS WORKSPACE TAB */}
                {activeTab === "events" && (
                  <div className="flex flex-col gap-6 flex-grow">
                    
                    {!selectedEvent ? (
                      // Events List Grid
                      events.length === 0 ? (
                        <div className="p-16 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-4 py-24 flex-grow w-full">
                          <Calendar className="w-10 h-10 text-gray-400/20" />
                          <span className="text-sm font-bold text-gray-200">No active events deployed</span>
                          <span className="text-xs text-gray-400 max-w-sm -mt-2">
                            Deploy a new events container using the Create Event workspace trigger.
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {events.map((event) => (
                            <motion.div
                              whileHover={{ y: -4 }}
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className="p-6 rounded-2xl glass-panel border border-white/[0.06] hover:border-primary/30 cursor-pointer flex flex-col justify-between transition-all duration-300 group min-h-[160px]"
                            >
                              <div>
                                <span className={`text-[9px] px-2.5 py-0.5 rounded-full border text-center font-bold uppercase tracking-wider ${getStatusBadge(event.status)}`}>
                                  {event.status}
                                </span>
                                <h3 className="text-sm font-bold text-white mt-4 group-hover:text-primary transition-colors font-display truncate">
                                  {event.title}
                                </h3>
                                <p className="mt-2 text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                  {event.description}
                                </p>
                              </div>
                              <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-gray-400">
                                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" />{event.location}</span>
                                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-secondary" />{event.date}</span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )
                    ) : (
                      // SELECTED EVENT MANAGEMENT & UPLOAD INTERFACE
                      <div className="space-y-6 flex-grow flex flex-col">
                        <button
                          onClick={() => { setSelectedEvent(null); setUploadSuccess(false); }}
                          className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors self-start"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Back to Events List</span>
                        </button>

                        <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] relative overflow-hidden group">
                          {/* Event banner widescreen display */}
                          <div className="h-40 -mx-6 -mt-6 mb-6 bg-gradient-to-br from-primary/10 to-secondary/10 relative overflow-hidden">
                            {(selectedEvent as any).banner_url || (selectedEvent as any).cover_url ? (
                              <img src={(selectedEvent as any).banner_url || (selectedEvent as any).cover_url} alt="" className="w-full h-full object-cover" />
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
                            
                            {/* Change Event Banner Overlay Button */}
                            {isElevated && (
                              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => document.getElementById("event-banner-upload-input")?.click()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/[0.08] hover:border-primary/40 text-[10px] font-bold text-white transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                                >
                                  <UploadCloud className="w-3.5 h-3.5 text-primary" />
                                  <span>{isUpdatingEventBanner ? "Updating..." : "Change Event Banner"}</span>
                                </button>
                                <input
                                  id="event-banner-upload-input"
                                  type="file"
                                  accept="image/*"
                                  onChange={handleUploadEventBanner}
                                  className="hidden"
                                />
                              </div>
                            )}
                          </div>

                          <div className="absolute top-44 right-6">
                            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadge(selectedEvent.status)}`}>
                              {selectedEvent.status}
                            </span>
                          </div>
                          <h2 className="text-xl font-extrabold text-white mt-4 font-display tracking-tight">
                            {selectedEvent.title}
                          </h2>
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-3xl">
                            {selectedEvent.description}
                          </p>
                          <div className="flex flex-wrap gap-6 text-xs text-gray-400 mt-4 pt-4 border-t border-white/[0.06]">
                            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />{selectedEvent.location}</span>
                            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-secondary" />{selectedEvent.date}</span>
                          </div>
                        </div>

                        {/* Drag and Drop multi-file uploader */}
                        <div className="p-8 rounded-2xl glass-panel border border-white/[0.06] space-y-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <UploadCloud className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white font-display">Upload Event Images</h3>
                              <p className="text-[10px] text-gray-400">Drag images or folders to upload to AI processing stream.</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="p-8 rounded-xl bg-black/40 border border-dashed border-white/[0.08] hover:border-primary/30 text-center relative cursor-pointer transition-all">
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => {
                                  setSelectedFiles(Array.from(e.target.files || []));
                                  setUploadSuccess(false);
                                  setUploadError("");
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              <ImageIcon className="w-8 h-8 text-gray-400/30 mx-auto mb-3" />
                              <span className="text-xs text-gray-400 block">
                                {selectedFiles.length > 0
                                  ? `${selectedFiles.length} image(s) selected`
                                  : "Click or drag images to drop here"
                                }
                              </span>
                            </div>

                            {selectedFiles.length > 0 && (
                              <button
                                onClick={handleUploadImages}
                                disabled={isUploading}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold transition-all disabled:opacity-50"
                              >
                                {isUploading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <UploadCloud className="w-4.5 h-4.5" />
                                    <span>Upload to AI Pipeline</span>
                                  </>
                                )}
                              </button>
                            )}

                            {isUploading && (
                              <div className="space-y-2">
                                <div className="w-full h-2 rounded-full bg-white/[0.04] overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-accentCyan to-accentRed rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                  ></div>
                                </div>
                                <span className="text-[10px] text-gray-400 block text-center uppercase tracking-wider font-semibold">AI Indexing Process Started ({uploadProgress}%)</span>
                              </div>
                            )}

                            {uploadSuccess && (
                              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-bold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 shadow-[0_0_10px_rgba(52,211,153,0.3)]" />
                                <span>Images loaded into Supabase Storage. AI face crop & pgvector embedding started!</span>
                              </div>
                            )}

                            {uploadError && (
                              <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 text-xs text-secondary font-semibold flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                <span>{uploadError}</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* 2. GALLERY TAB */}
                {activeTab === "gallery" && (
                  <div className="p-12 rounded-2xl glass-panel border border-white/[0.06] text-center flex flex-col items-center gap-4 py-20 flex-grow justify-center w-full">
                    <ImageIcon className="w-12 h-12 text-primary animate-pulse" />
                    <h3 className="text-base font-bold text-white font-display">Workspace Private Photo Assets Stream</h3>
                    <p className="text-xs text-gray-400 max-w-md leading-relaxed">
                       clearance authorized. You can inspect all contributor photo folders, preview AI crop tag locations, and download full raw galleries.
                    </p>
                  </div>
                )}

                {/* 3. ACCESS REQUESTS QUEUE TAB */}
                {activeTab === "requests" && canManageEcosystem && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold text-white font-display">Contributor Access Approvals Queue</h3>
                    </div>

                    {requests.length === 0 ? (
                      <div className="p-12 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-4 py-16 flex-grow w-full">
                        <UserCheck className="w-8 h-8 text-gray-400/20" />
                        <span className="text-xs text-gray-400">No pending contributor access requests.</span>
                      </div>
                    ) : (
                      <div className="grid gap-4 w-full">
                        {requests.map((req) => (
                          <div 
                            key={req.id}
                            className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex items-center justify-between gap-6 hover:border-primary/20 transition-all duration-300"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-white">{req.user.full_name}</span>
                                <span className="text-[10px] text-primary font-semibold">@{req.user.username}</span>
                                <span className="text-[8px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white font-mono uppercase tracking-wider">{req.request_type}</span>
                              </div>
                              <span className="text-[9px] text-gray-400 block mt-1.5">Submitted: {new Date(req.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleReviewRequest(req.id, "approved")}
                                className="px-4 py-2 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold transition-all shadow-[0_0_10px_#06b6d4]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReviewRequest(req.id, "rejected")}
                                className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-secondary/10 border border-white/[0.08] text-gray-400 hover:text-secondary text-xs font-semibold transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. MEMBERS DIRECTORY TAB */}
                {activeTab === "members" && canManageEcosystem && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-white font-display">Collaborators & Permissions Control</h3>
                      </div>
                      <button
                        onClick={() => setIsOpenInviteModal(true)}
                        className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-primary text-black hover:bg-white text-xs font-bold transition-all shadow-lg"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Invite Collaborator</span>
                      </button>
                    </div>

                    <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                      {roles?.map((r) => {
                        const isSelf = r.user.email === user?.email;
                        let badgeStyle = "bg-white/[0.04] border-white/[0.08] text-gray-300";
                        if (r.role === "host") badgeStyle = "bg-secondary/15 border-secondary/30 text-secondary shadow-[0_0_10px_rgba(255,45,45,0.1)]";
                        if (r.role === "admin") badgeStyle = "bg-primary/15 border-primary/30 text-primary shadow-[0_0_10px_rgba(0,229,255,0.1)]";
                        if (r.role === "contributor") badgeStyle = "bg-purple-500/10 border-purple-500/20 text-purple-400";

                        return (
                          <div key={r.id} className="flex items-center justify-between border-b border-white/[0.06] pb-4 last:border-0 last:pb-0 p-2 rounded-xl hover:bg-white/[0.01] transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-xs font-bold text-white uppercase">{r.user.full_name.charAt(0)}</div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white leading-none">{r.user.full_name}</span>
                                  <span className="text-[10px] text-gray-400 leading-none">@{r.user.username}</span>
                                  {isSelf && <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold uppercase scale-90">Self</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400 font-semibold">
                                  <span className={`px-2 py-0.5 rounded-full border text-[8px] font-extrabold ${badgeStyle}`}>{r.role.toUpperCase()}</span>
                                  <span>Joined: {new Date(r.user.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            {isHost && !isSelf && (
                              <div className="flex items-center gap-3">
                                <select
                                  value={r.role}
                                  onChange={(e) => handleUpdateMemberRole(r.user.id, e.target.value)}
                                  className="px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/[0.08] text-[10px] font-bold text-white focus:outline-none focus:border-primary/30 cursor-pointer"
                                >
                                  <option value="admin">Admin</option>
                                  <option value="contributor">Contributor</option>
                                  <option value="gallery_access">Gallery Access</option>
                                  <option value="member">Regular Member</option>
                                </select>
                                <button
                                  onClick={() => handleRemoveMember(r.user.id)}
                                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-secondary/10 border border-white/[0.08] text-gray-400 hover:text-secondary transition-all"
                                  title="Evict Member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. ANALYTICS TAB */}
                {activeTab === "analytics" && canManageEcosystem && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                      <Activity className="w-4 h-4 text-primary animate-pulse" />
                      <h3 className="text-sm font-bold text-white font-display">Workspace AI Engine Analytics</h3>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Events Deployed</span>
                        <span className="text-2xl font-extrabold text-white mt-2">{events.length}</span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Searches</span>
                        <span className="text-2xl font-extrabold text-primary mt-2">
                          {recognitionStats?.total_searches?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Matches Found</span>
                        <span className="text-2xl font-extrabold text-emerald-400 mt-2">
                          {recognitionStats?.total_photos_found?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Storage Used</span>
                        <span className="text-2xl font-extrabold text-white mt-2">
                          {formatBytes(recognitionStats?.storage_used_bytes || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. RECOGNITION HISTORY TAB */}
                {activeTab === "recognition" && canManageEcosystem && (
                  <div className="flex flex-col gap-6 flex-grow">
                    {/* HEADER */}
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <ScanFace className="w-4 h-4 text-primary animate-pulse" />
                        <h3 className="text-sm font-bold text-white font-display">AI Recognition Intelligence</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-[9px] font-extrabold uppercase tracking-widest text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                          <span>Live Engine Feed</span>
                        </div>
                        <button
                          onClick={() => fetchRecognitionData(false)}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-400 hover:text-white transition-all flex items-center justify-center"
                          title="Refresh Database Logs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${recognitionLoading ? "animate-spin text-primary" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {recognitionLoading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    ) : (
                      <>
                        {/* STATS CARDS */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                          <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5"><Search className="w-3 h-3" /> Total Searches</span>
                            <span className="text-2xl font-extrabold text-white mt-2">{recognitionStats?.total_searches?.toLocaleString() || 0}</span>
                          </div>
                          <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5"><ImageIcon className="w-3 h-3" /> Photos Found</span>
                            <span className="text-2xl font-extrabold text-emerald-400 mt-2">{recognitionStats?.total_photos_found?.toLocaleString() || 0}</span>
                          </div>
                          <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5"><Shield className="w-3 h-3" /> Failed Searches</span>
                            <span className="text-2xl font-extrabold text-secondary mt-2">{recognitionStats?.failed_searches || 0}</span>
                          </div>
                          <div className="p-5 rounded-2xl glass-panel border border-primary/10 flex flex-col justify-between min-h-[100px]">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5"><Users className="w-3 h-3" /> Most Active</span>
                            <span className="text-xl font-extrabold text-primary mt-2">@{recognitionStats?.most_active_username || "—"}</span>
                          </div>
                        </div>

                        {/* SEARCH & FILTERS */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex-grow relative max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search username, user ID, or event..."
                              value={recognitionSearch}
                              onChange={(e) => setRecognitionSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder:text-gray-400 focus:outline-none focus:border-primary/30 transition-colors"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] p-1 rounded-xl flex-wrap">
                            {[
                              { key: "all", label: "All" },
                              { key: "verified", label: "Verified" },
                              { key: "failed", label: "Failed" },
                              { key: "no_match", label: "No Match" },
                            ].map((f) => (
                              <button
                                key={f.key}
                                onClick={() => setRecognitionFilter(f.key)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                  recognitionFilter === f.key
                                    ? "bg-primary text-black"
                                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* ACTIVITY TABLE */}
                        {filteredRecognition.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-gray-400 mb-4">
                              <ScanFace className="w-10 h-10" />
                            </div>
                            <h4 className="text-sm font-bold text-white font-display">No Recognition Activity Yet</h4>
                            <p className="text-[11px] text-gray-400 mt-2 max-w-sm">When users perform face verification in your events, their search activity will appear here in realtime.</p>
                          </div>
                        ) : (
                          <div className="rounded-2xl glass-panel border border-white/[0.06] overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/[0.06] text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                              <span className="col-span-3">User</span>
                              <span className="col-span-2">Event</span>
                              <span className="col-span-1 text-center">Photos</span>
                              <span className="col-span-2 text-center">Confidence</span>
                              <span className="col-span-2">Time</span>
                              <span className="col-span-1 text-center">Status</span>
                              <span className="col-span-1 text-center">Action</span>
                            </div>
                            {/* Table Rows */}
                            <div className="divide-y divide-white/5">
                              {filteredRecognition.map((rec) => {
                                const statusStyles: Record<string, string> = {
                                  verified: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                                  failed: "bg-secondary/10 border-secondary/20 text-secondary",
                                  pending: "bg-primary/10 border-primary/20 text-primary",
                                };
                                const isNoMatch = rec.status === "verified" && rec.matched_photos_count === 0;
                                const displayStatus = isNoMatch ? "NO MATCH" : rec.status.toUpperCase();
                                const statusStyle = isNoMatch ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : (statusStyles[rec.status] || statusStyles.pending);
                                const timeAgo = getTimeAgo(rec.created_at);

                                return (
                                  <motion.div
                                    key={rec.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors"
                                  >
                                    {/* User */}
                                    <div className="col-span-3 flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary uppercase">
                                        {rec.user.full_name?.[0] || "?"}
                                      </div>
                                      <div>
                                        <span className="text-[11px] font-semibold text-white block leading-tight">
                                          {rec.user.username.startsWith("@") ? rec.user.username : `@${rec.user.username}`}
                                        </span>
                                        <span className="text-[9px] text-gray-400">{rec.user.full_name}</span>
                                      </div>
                                    </div>
                                    {/* Event */}
                                    <div className="col-span-2">
                                      <span className="text-[10px] text-white font-medium truncate block">{rec.event?.title || "Unknown"}</span>
                                    </div>
                                    {/* Photos */}
                                    <div className="col-span-1 text-center">
                                      <span className={`text-xs font-bold ${rec.matched_photos_count > 0 ? "text-emerald-400" : "text-gray-400"}`}>
                                        {rec.matched_photos_count}
                                      </span>
                                    </div>
                                    {/* Confidence */}
                                    <div className="col-span-2 flex items-center justify-center gap-1.5">
                                      <div className="w-16 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            rec.average_confidence >= 0.8 ? "bg-emerald-400" :
                                            rec.average_confidence >= 0.6 ? "bg-primary" : "bg-amber-400"
                                          }`}
                                          style={{ width: `${(rec.average_confidence * 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold text-white">{(rec.average_confidence * 100).toFixed(0)}%</span>
                                    </div>
                                    {/* Time */}
                                    <div className="col-span-2">
                                      <span className="text-[10px] text-gray-400">{timeAgo}</span>
                                    </div>
                                    {/* Status */}
                                    <div className="col-span-1 text-center">
                                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusStyle}`}>
                                        {displayStatus}
                                      </span>
                                    </div>
                                    {/* Action */}
                                    <div className="col-span-1 text-center">
                                      <button
                                        onClick={() => setSelectedRecognition(rec)}
                                        className="text-[9px] font-bold text-primary hover:text-white transition-colors uppercase tracking-wider"
                                      >
                                        Details
                                      </button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 7. SETTINGS TAB */}
                {activeTab === "settings" && canManageEcosystem && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                      <Settings className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold text-white font-display">Group Administration Workspace</h3>
                    </div>

                    <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] flex flex-col gap-6 w-full">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Group Visibility</h4>
                            <span className="text-[11px] text-gray-400 mt-1 block">Strict Mode active. Events listings are visible.</span>
                          </div>
                          <div className="w-10 h-6 bg-primary/20 border border-primary/30 rounded-full flex items-center p-0.5 cursor-pointer justify-end">
                            <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_10px_#06b6d4]"></div>
                          </div>
                        </div>
                      </div>

                      {isHost && (
                        <div className="border-t border-white/[0.06] pt-6">
                          <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Danger Zone</h4>
                          <button
                            onClick={handleDeleteCommunity}
                            className="px-4 py-2.5 rounded-xl bg-secondary/15 border border-secondary/20 text-secondary hover:bg-secondary text-xs font-semibold hover:text-white transition-all shadow-[0_0_15px_rgba(255,45,45,0.05)]"
                          >
                            Delete Workspace Group
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </main>

      {/* CREATE EVENT MODAL */}
      <AnimatePresence>
        {isOpenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl rounded-2xl glass-panel border border-white/[0.08] relative z-10 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[500px]"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-accentCyan to-accentRed"></div>
              
              <div className="p-8 lg:col-span-7 flex flex-col justify-between border-r border-white/[0.06] h-full">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight font-display mb-1">Deploy Live Event Container</h2>
                  <p className="text-xs text-gray-400 mb-6">Launch a new memory registry where visitors run biometric searches.</p>

                  {eventErrorMsg && (
                    <div className="mb-5 p-3 rounded-xl bg-secondary/10 border border-secondary/20 text-xs text-secondary font-semibold animate-pulse">
                      {eventErrorMsg}
                    </div>
                  )}

                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Event Title</label>
                      <input
                        type="text"
                        required
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        placeholder="e.g. Hackathon Final Showcase"
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all duration-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Description</label>
                      <textarea
                        required
                        rows={2}
                        value={eventDesc}
                        onChange={(e) => setEventDesc(e.target.value)}
                        placeholder="Brief overview of photopacks contents..."
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all duration-300 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Location Venue</label>
                        <input
                          type="text"
                          required
                          value={eventLoc}
                          onChange={(e) => setEventLoc(e.target.value)}
                          placeholder="e.g. Grand Ballroom"
                          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all duration-300"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Event Date</label>
                        <input
                          type="date"
                          required
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white transition-all duration-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Event Custom Banner</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => document.getElementById("event-create-banner-input")?.click()}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-primary/30 text-xs font-semibold text-white transition-all"
                        >
                          <UploadCloud className="w-4 h-4 text-primary" />
                          <span>{eventBannerFile ? "Change Custom Banner" : "Upload Custom Banner"}</span>
                        </button>
                        {eventBannerFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setEventBannerFile(null);
                              setEventBannerPreview(null);
                            }}
                            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-secondary/10 border border-white/[0.08] text-gray-400 hover:text-secondary transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <input
                          id="event-create-banner-input"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setEventBannerFile(file);
                              setEventBannerPreview(URL.createObjectURL(file));
                            }
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </form>
                </div>

                <div className="flex gap-4 pt-6 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setIsOpenModal(false)}
                    className="flex-grow py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white font-semibold transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateEvent}
                    disabled={isSubmittingEvent}
                    className="flex-grow flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-primary hover:bg-white text-black font-display transition-all duration-300"
                  >
                    {isSubmittingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                      <Sparkles className="w-4 h-4" />
                      <span>Deploy Event</span>
                    </>}
                  </button>
                </div>
              </div>

              <div className="p-8 lg:col-span-5 bg-black/40 flex flex-col justify-center h-full relative overflow-hidden min-h-[300px]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/[0.03] blur-3xl -z-10"></div>
                <span className="text-[9px] font-extrabold text-primary uppercase tracking-widest block mb-4 border-b border-white/[0.06] pb-2 text-center">Live Event Card Preview</span>

                <div className="rounded-2xl glass-panel border border-white/[0.08] overflow-hidden relative shadow-2xl flex flex-col min-h-[200px]">
                  <div className="h-28 w-full relative overflow-hidden bg-white/5">
                    <img src={activeEventCover} alt="Event Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
                  </div>
                  <div className="p-5 flex-grow flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white font-display truncate">{eventTitle || "Hackathon Final Showcase"}</h4>
                      <p className="text-[10px] text-gray-400 leading-relaxed mt-1 line-clamp-3">
                        {eventDesc || "Preview dynamic covers suggested dynamically based on category visuals, overlays, and custom presets."}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[9px] text-gray-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary" />{eventLoc || "Grand Ballroom"}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-secondary" />{eventDate || "YYYY-MM-DD"}</span>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INVITE MEMBERS SEARCH MODAL */}
      <AnimatePresence>
        {isOpenInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsOpenInviteModal(false); setInviteSuccessMsg(""); }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-accentCyan to-accentRed"></div>
              
              <h2 className="text-lg font-bold text-white font-display mb-2 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Invite Workspace Collaborator</span>
              </h2>
              <p className="text-xs text-gray-400 mb-6">Type user's username, email, or ID to send realtime invitations.</p>

              {inviteSuccessMsg && (
                <div className="mb-5 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-bold animate-pulse">
                  {inviteSuccessMsg}
                </div>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={inviteSearchQuery}
                    onChange={(e) => setInviteSearchQuery(e.target.value)}
                    placeholder="Search by @username..."
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all duration-300"
                  />
                  {isSearchingUsers && (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin absolute right-4 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
                  {searchedUsers.length === 0 && inviteSearchQuery.trim() && !isSearchingUsers ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Search className="w-8 h-8 text-gray-600 mb-2" />
                      <span className="text-[11px] font-bold text-white font-display">No User Found</span>
                      <p className="text-[9px] text-gray-400 mt-1 max-w-[240px]">We couldn't find any users matching your query. Double check the spelling or email.</p>
                    </div>
                  ) : (
                    searchedUsers?.map((u) => {
                      const hasActiveRole = roles?.some((r) => r.user.id === u.id);
                      const isAlreadyInvited = invitations?.some((inv) => inv.invitee.id === u.id && inv.status === "pending");

                      return (
                        <div key={u.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase">
                              {u.full_name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white block leading-none">{u.full_name}</span>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[9px] text-primary font-semibold leading-none">
                                  {u.username.startsWith("@") ? u.username : `@${u.username}`}
                                </span>
                                {u.email && (
                                  <span className="text-[9px] text-gray-400 leading-none">• {u.email}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {hasActiveRole ? (
                            <span className="text-[8px] font-bold px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">Already present in the group</span>
                          ) : isAlreadyInvited ? (
                            <span className="text-[8px] font-bold px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-primary uppercase tracking-wider animate-pulse">Invite Pending</span>
                          ) : (
                            <button
                              onClick={() => handleSendInvitation(u.username)}
                              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-white text-black text-[10px] font-bold transition-all shadow"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                onClick={() => { setIsOpenInviteModal(false); setInviteSuccessMsg(""); }}
                className="w-full mt-6 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white font-semibold transition-all duration-300"
              >
                Close Panel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECOGNITION DETAILS MODAL */}
      <AnimatePresence>
        {selectedRecognition && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecognition(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl glass-panel border border-white/[0.08] relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-accentCyan to-emerald-400"></div>

              {/* Header */}
              <div className="p-6 border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary uppercase">
                      {selectedRecognition.user.full_name?.[0] || "?"}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {selectedRecognition.user.username.startsWith("@") ? selectedRecognition.user.username : `@${selectedRecognition.user.username}`}
                      </h3>
                      <p className="text-[10px] text-gray-400">{selectedRecognition.user.full_name} • {selectedRecognition.user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedRecognition(null)} className="p-2 rounded-xl hover:bg-white/[0.04] transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-none">
                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Photos Found</span>
                    <span className="text-lg font-extrabold text-emerald-400 mt-1 block">{selectedRecognition.matched_photos_count}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Avg Confidence</span>
                    <span className="text-lg font-extrabold text-primary mt-1 block">{(selectedRecognition.average_confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Processing</span>
                    <span className="text-lg font-extrabold text-white mt-1 block">{selectedRecognition.processing_time_ms}ms</span>
                  </div>
                </div>

                {/* Event Info */}
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Event Searched</span>
                  <p className="text-sm font-semibold text-white">{selectedRecognition.event?.title || "Unknown Event"}</p>
                  {selectedRecognition.event?.location && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedRecognition.event.location}</p>
                  )}
                </div>

                {/* Status & Liveness */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Verification Status</span>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${
                      selectedRecognition.status === "verified"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-secondary/10 border-secondary/20 text-secondary"
                    }`}>
                      {selectedRecognition.status === "verified" && selectedRecognition.matched_photos_count === 0
                        ? "NO MATCH"
                        : selectedRecognition.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Liveness Score</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-grow h-2 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            selectedRecognition.liveness_score >= 0.8 ? "bg-emerald-400" :
                            selectedRecognition.liveness_score >= 0.5 ? "bg-amber-400" : "bg-secondary"
                          }`}
                          style={{ width: `${selectedRecognition.liveness_score * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white">{(selectedRecognition.liveness_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Timestamp</span>
                  <p className="text-xs text-white font-medium">{new Date(selectedRecognition.created_at).toLocaleString()}</p>
                </div>

                {/* Device & Network */}
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-3">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Device & Network</span>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">IP Address</span>
                      <span className="text-[10px] font-mono text-white">{selectedRecognition.ip_address || "N/A"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[10px] text-gray-400 shrink-0">Device Info</span>
                      <span className="text-[10px] text-white text-right break-all leading-relaxed">{
                        selectedRecognition.device_info
                          ? selectedRecognition.device_info.length > 80
                            ? selectedRecognition.device_info.substring(0, 80) + "..."
                            : selectedRecognition.device_info
                          : "N/A"
                      }</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/[0.06]">
                <button
                  onClick={() => setSelectedRecognition(null)}
                  className="w-full py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white font-semibold transition-all"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
