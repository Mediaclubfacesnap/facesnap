"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import CommunityMoreMenu from "@/components/community/CommunityMoreMenu";
import { 
  Plus, Users, Calendar, MapPin, Sparkles, Loader2, 
  ArrowLeft, Compass, CheckCircle2, Activity, Image as ImageIcon,
  Settings, UserCheck, Trash2, Camera, UploadCloud, 
  X, ChevronRight, Check, Share2, Link2, Bell, Home, LogOut,
  Search, Shield, Clock, Eye, ScanFace, BarChart3, Filter, RefreshCw, AlertCircle, MessageSquare,
  MoreVertical, ShieldCheck, Crown, UserMinus, QrCode
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
  creator_id?: string;
  max_participants?: number | null;
  category?: string | null;
  registration_deadline?: string | null;
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

interface CommunityJoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  status: string;
  message?: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    username: string;
    email: string;
    created_at: string;
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

const getOptimizedImageUrl = (url: string, width: number = 300) => {
  if (!url) return "";
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${width}&resize=contain`;
  }
  return url;
};

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
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([]);
  const [invitations, setInvitations] = useState<DBInvitation[]>([]);
  const [myRoles, setMyRoles] = useState<Record<string, string>>({});
  
  // Current user's role: "host" | "admin" | "contributor"
  const [currentUserRole, setCurrentUserRole] = useState<string>(""); 
  const [activeTab, setActiveTab] = useState<"events" | "gallery" | "requests" | "members" | "settings" | "analytics" | "recognition" | "announcements" | "chat" | "calendar" | "leaderboard" | "highlights">("events");
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Phase 3 Chat States
  const [chatChannel, setChatChannel] = useState("general");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Phase 3 Leaderboard States
  const [commLeaderboard, setCommLeaderboard] = useState<any[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  // Phase 4A Gallery States
  const [galleryMedia, setGalleryMedia] = useState<any[]>([]);
  const [galleryAlbums, setGalleryAlbums] = useState<any[]>([]);
  const [galleryTab, setGalleryTab] = useState<"photos" | "videos" | "albums">("photos");
  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState<string>("all");
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumDesc, setNewAlbumDesc] = useState("");
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<any | null>(null);

  // Phase 3 Calendar States
  const [calendarView, setCalendarView] = useState<"month" | "week" | "agenda">("month");

  // Event Discussion Thread States
  const [eventComments, setEventComments] = useState<any[]>([]);
  const [newCommentContent, setNewCommentContent] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // AI Event Summary State
  const [eventSummary, setEventSummary] = useState<any>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Announcements States
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isOpenAnnModal, setIsOpenAnnModal] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);

  // Per-tab loading states for More-menu dynamic tabs
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  // Event Registrations States
  const [registeredEvents, setRegisteredEvents] = useState<Record<string, boolean>>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [eventRegistrationsCount, setEventRegistrationsCount] = useState<Record<string, number>>({});
  const [isRegistering, setIsRegistering] = useState(false);

  // Ownership Transfer States
  const [isOpenTransferModal, setIsOpenTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Analytics Metrics State
  const [commAnalytics, setCommAnalytics] = useState<any>(null);

  // Recognition History States
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionRecord[]>([]);
  const [recognitionStats, setRecognitionStats] = useState<RecognitionStats | null>(null);
  const [recognitionLoading, setRecognitionLoading] = useState(false);
  const [recognitionSearch, setRecognitionSearch] = useState("");
  const [recognitionFilter, setRecognitionFilter] = useState<string>("all");
  const [selectedRecognition, setSelectedRecognition] = useState<RecognitionRecord | null>(null);

  // Phase 4D Highlights States
  const [highlightsAlbums, setHighlightsAlbums] = useState<any[]>([]);
  const [selectedHighlightsAlbum, setSelectedHighlightsAlbum] = useState<any | null>(null);
  const [highlightsPhotos, setHighlightsPhotos] = useState<any[]>([]);
  const [highlightsLogs, setHighlightsLogs] = useState<any[]>([]);
  const [isHighlightsLoading, setIsHighlightsLoading] = useState(false);
  const [isGeneratingHighlights, setIsGeneratingHighlights] = useState(false);
  const [highlightsLimit, setHighlightsLimit] = useState(25);

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
  const [eventCategory, setEventCategory] = useState("Workshop");
  const [eventMaxParticipants, setEventMaxParticipants] = useState("");
  const [eventRegistrationDeadline, setEventRegistrationDeadline] = useState("");
  const [eventCategoryFilter, setEventCategoryFilter] = useState("all");
  const [eventStatusFilter, setEventStatusFilter] = useState("all");
  const [selectedEventStats, setSelectedEventStats] = useState<any | null>(null);
  const [selectedEventParticipants, setSelectedEventParticipants] = useState<any[]>([]);
  const [selectedEventWaitlist, setSelectedEventWaitlist] = useState<any[]>([]);
  const [eventDetailTab, setEventDetailTab] = useState<"upload" | "participants" | "waitlist" | "analytics">("upload");
  const [isEventStatsLoading, setIsEventStatsLoading] = useState(false);
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");

  // Event Access Request State
  const [showEventAccessModal, setShowEventAccessModal] = useState(false);
  const [eventAccessReason, setEventAccessReason] = useState("");
  const [eventAccessError, setEventAccessError] = useState("");
  const [eventAccessSuccess, setEventAccessSuccess] = useState(false);
  const [isSubmittingAccess, setIsSubmittingAccess] = useState(false);

  // Event Deletion state
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [deleteEventTitle, setDeleteEventTitle] = useState("");
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // Invite Members Modal State
  const [isOpenInviteModal, setIsOpenInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");

  const [inviteTab, setInviteTab] = useState<"search" | "code">("search");
  const [inviteJoinMode, setInviteJoinMode] = useState<"auto" | "approval">("auto");
  const [inviteExpires, setInviteExpires] = useState<number>(0);
  const [inviteMaxUses, setInviteMaxUses] = useState<number>(0);
  const [inviteCodesList, setInviteCodesList] = useState<any[]>([]);
  const [isGeneratingInviteCode, setIsGeneratingInviteCode] = useState(false);
  const [selectedQRInvite, setSelectedQRInvite] = useState<any | null>(null);

  const fetchInviteCodes = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/invite-codes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInviteCodesList(data);
      }
    } catch (err) {
      console.error("Failed to fetch invite codes:", err);
    }
  };

  const handleGenerateInviteCode = async () => {
    setIsGeneratingInviteCode(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/invite-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          join_mode: inviteJoinMode,
          expires_in_days: inviteExpires > 0 ? inviteExpires : null,
          max_uses: inviteMaxUses > 0 ? inviteMaxUses : null
        })
      });
      if (res.ok) {
        await fetchInviteCodes();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to generate invite code.");
      }
    } catch (err) {
      console.error("Generate invite code error:", err);
    } finally {
      setIsGeneratingInviteCode(false);
    }
  };

  const handleDeleteInviteCode = async (codeId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/invite-codes/${codeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchInviteCodes();
        if (selectedQRInvite?.id === codeId) setSelectedQRInvite(null);
      }
    } catch (err) {
      console.error("Delete invite code error:", err);
    }
  };

  useEffect(() => {
    if (isOpenInviteModal) {
      fetchInviteCodes();
    }
  }, [isOpenInviteModal]);

  // Super Admin Role Management State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedMemberAction, setSelectedMemberAction] = useState<{ 
    id: string, 
    name: string, 
    currentRole: string, 
    newRole?: string | null, 
    actionType: "promote" | "remove_access" | "remove" | "transfer" 
  } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const isSuperAdmin = user?.platform_role === "super_admin";

  const isHost = currentUserRole === "host";
  const isAdmin = currentUserRole === "admin";
  const isContributor = currentUserRole === "contributor";
  const isElevated = ["host", "admin", "moderator"].includes(currentUserRole) || user?.can_create_events || user?.platform_role === "admin" || user?.platform_role === "super_admin";
  const canCreateEvents = user?.platform_role === "admin" || user?.platform_role === "super_admin" || user?.can_create_events === true;

  const canManageEcosystem = ["host", "admin"].includes(currentUserRole);

  const getDeadlineText = (deadlineStr: string | null | undefined) => {
    if (!deadlineStr) return null;
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) return "⛔ Closed";
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diffDays > 0) return `⏰ ${diffDays}d ${diffHours}h left`;
    return `⏰ ${diffHours}h left`;
  };

  const filteredEvents = events.filter((e) => {
    if (eventCategoryFilter !== "all" && e.category !== eventCategoryFilter) return false;
    
    if (eventStatusFilter === "open") {
      if (e.status !== "upcoming" && e.status !== "published") return false;
      if (e.registration_deadline && new Date(e.registration_deadline).getTime() < Date.now()) return false;
      const regsCount = eventRegistrationsCount[e.id] || 0;
      if (e.max_participants && regsCount >= e.max_participants) return false;
    } else if (eventStatusFilter === "full") {
      const regsCount = eventRegistrationsCount[e.id] || 0;
      if (!e.max_participants || regsCount < e.max_participants) return false;
    } else if (eventStatusFilter === "registered") {
      if (!registeredEvents[e.id]) return false;
    }
    return true;
  });

  const confirmDeleteEvent = (id: string, title: string) => {
    setDeleteEventId(id);
    setDeleteEventTitle(title);
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventId || !token) return;
    setIsDeletingEvent(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${deleteEventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== deleteEventId));
        setDeleteEventId(null);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete event.");
      }
    } catch (err) {
      console.error("Delete event error:", err);
    } finally {
      setIsDeletingEvent(false);
    }
  };

  // ─── Recognition History Helpers ───────────────────────────
  const fetchRecognitionData = async (silent = false) => {
    if (!token) return;
    if (!silent) setRecognitionLoading(true);
    try {
      const [historyRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/history/${communityId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/stats/${communityId}`, {
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

      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/uploads/banner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.detail || "Banner upload failed.");
      }

      const { banner_url } = await uploadRes.json();

      const updateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/banner`, {
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

      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/uploads/banner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.detail || "Banner upload failed.");
      }

      const { banner_url } = await uploadRes.json();

      const updateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/banner`, {
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
      const allCommRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (allCommRes.ok) {
        const allCommData = await allCommRes.json();
        setCommunities(allCommData);
      }

      // 2. Fetch my roles map
      const myRolesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let verifiedRole = "none";
      if (myRolesRes.ok) {
        const rolesMap = await myRolesRes.json();
        setMyRoles(rolesMap);
        if (user?.platform_role === "super_admin") {
          verifiedRole = "host";
        } else if (communityId in rolesMap) {
          const roleVal = rolesMap[communityId];
          verifiedRole = roleVal === null ? "participant" : roleVal;
        } else {
          verifiedRole = "none";
        }
        setCurrentUserRole(verifiedRole);
      }

      // 3. Redirect immediately to lock screen if not approved participant/host/admin/moderator
      if (verifiedRole === "none") {
        router.push(`/dashboard/communities/${communityId}`);
        return;
      }

      // 4. Fetch selected community metadata
      const commRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!commRes.ok) throw new Error("Community workspace not found.");
      const commData = await commRes.json();
      setCommunity(commData);

      // 5. Fetch community collaborator roles list
      const rolesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }

      // 6. Fetch events and their participant statuses
      const eventsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/community/${communityId}`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);

        // Fetch participant counts & registration status for each event
        const regsMap: Record<string, boolean> = {};
        const countMap: Record<string, number> = {};
        
        await Promise.all(eventsData.map(async (ev: Event) => {
          try {
            const pRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${ev.id}/participants`);
            if (pRes.ok) {
              const pData = await pRes.json();
              countMap[ev.id] = pData.length;
              const isRegistered = pData.some((p: any) => p.user_id === user?.id);
              regsMap[ev.id] = isRegistered;
            }
          } catch (e) {
            console.error("Failed to fetch participants for event:", ev.id, e);
          }
        }));

        setRegisteredEvents(regsMap);
        setEventRegistrationsCount(countMap);
      }

      // 6b. Fetch announcements
      const annRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (annRes.ok) {
        setAnnouncements(await annRes.json());
      }

      // 6c. Fetch community analytics
      const analyticsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (analyticsRes.ok) {
        setCommAnalytics(await analyticsRes.json());
      }

      // 7. Fetch Requests & Invitations if Host/Admin
      const isPrivileged = ["host", "admin"].includes(verifiedRole);
      if (isPrivileged) {
        const reqsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/requests`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (reqsRes.ok) {
          const reqsData = await reqsRes.json();
          setRequests(reqsData);
        }

        const invitesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/invitations`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (invitesRes.ok) {
          const invitesData = await invitesRes.json();
          setInvitations(invitesData);
        }

        const joinReqsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/join-requests`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (joinReqsRes.ok) {
          setJoinRequests(await joinReqsRes.json());
        }

        // 8. Fetch recognition stats for analytics
        const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/stats/${communityId}`, {
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

        const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/uploads/banner`, {
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${communityId}`, {
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
          cover_url: finalBannerUrl,
          category: eventCategory,
          max_participants: eventMaxParticipants ? parseInt(eventMaxParticipants) : null,
          registration_deadline: eventRegistrationDeadline || null
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
      setEventCategory("Workshop");
      setEventMaxParticipants("");
      setEventRegistrationDeadline("");
      setEvents((prev) => [data, ...prev]);
    } catch (err: any) {
      setEventErrorMsg(err.message || "Failed to deploy event container.");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleRequestEventAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventAccessError("");
    setEventAccessSuccess(false);
    setIsSubmittingAccess(true);

    try {
      if (!token) throw new Error("No authentication token found.");
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/access-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          community_id: communityId,
          reason: eventAccessReason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit request.");

      setEventAccessSuccess(true);
      setTimeout(() => {
        setShowEventAccessModal(false);
      }, 3000);
    } catch (err: any) {
      setEventAccessError(err.message);
    } finally {
      setIsSubmittingAccess(false);
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

          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/uploads/${selectedEvent.id}`, {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/requests/${requestId}/review`, {
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
  const fetchJoinRequests = async () => {
    setIsRequestsLoading(true);
    try {
      const joinReqsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/join-requests`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (joinReqsRes.ok) {
        setJoinRequests(await joinReqsRes.json());
      }
    } catch (err) {
      console.error("Failed to fetch join requests:", err);
    } finally {
      setIsRequestsLoading(false);
    }
  };

  // Standalone announcements fetch — called when switching to the announcements tab
  const fetchAnnouncements = async () => {
    if (!token) return;
    setIsAnnouncementsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setAnnouncements(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setIsAnnouncementsLoading(false);
    }
  };

  const fetchCommunityMembers = async () => {
    setIsMembersLoading(true);
    try {
      const rolesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/roles`);
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }
    } catch (err) {
      console.error("Failed to fetch community members:", err);
    } finally {
      setIsMembersLoading(false);
    }
  };

  const fetchCommunityStats = async () => {
    setIsAnalyticsLoading(true);
    try {
      const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/stats/${communityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setRecognitionStats(statsData);
      }

      const analyticsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (analyticsRes.ok) {
        setCommAnalytics(await analyticsRes.json());
      }
    } catch (err) {
      console.error("Failed to fetch community stats:", err);
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  const handleReviewJoinRequest = async (requestId: string, decision: "approved" | "rejected") => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/join-requests/${requestId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ decision })
      });
      if (response.ok) {
        setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        await fetchData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to review join request:", err);
      return false;
    }
  };

  const handleApprove = async (requestId: string) => {
    console.log("APPROVE CLICKED", requestId);
    try {
      const ok = await handleReviewJoinRequest(requestId, "approved");
      if (ok) {
        await fetchJoinRequests();
        await fetchCommunityMembers();
        await fetchCommunityStats();
      }
    } catch (err) {
      console.error("APPROVE FAILED", err);
    }
  };

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/members/${userId}/role`, {
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
        alert(data.detail || "Unable to update participant role.");
      }
    } catch (err) {
      console.error("Failed to update member role:", err);
    }
  };

  const handlePromoteMember = async (userId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/promote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId, role: "admin" })
      });
      if (response.ok) {
        alert("Participant promoted");
        await fetchData();
      } else {
        const data = await response.json();
        alert(data.detail || "Unable to promote participant.");
      }
    } catch (err) {
      console.error("Failed to promote member:", err);
    }
  };

  const handleDemoteAdmin = async (userId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/remove_access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });
      if (response.ok) {
        alert("Admin remove_accessd");
        await fetchData();
      } else {
        const data = await response.json();
        alert(data.detail || "Unable to remove_access admin.");
      }
    } catch (err) {
      console.error("Failed to remove_access admin:", err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/members/${userId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        await fetchData();
      } else {
        const data = await response.json();
        alert(data.detail || "Unable to remove participant.");
      }
    } catch (err) {
      console.error("Failed to remove member:", err);
      alert(`Failed to remove participant. Please try again.`);
    }
  };

  const handleSuperAdminRoleUpdate = async () => {
    if (!selectedMemberAction || !selectedMemberAction.newRole) return;
    setIsUpdatingRole(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/members/${selectedMemberAction.id}/role`, {
        method: "PATCH",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: selectedMemberAction.newRole })
      });
      if (response.ok) {
        await fetchData();
        setSelectedMemberAction(null);
      } else {
        const data = await response.json();
        alert(data.detail || "Unable to update role.");
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    } finally {
      setIsUpdatingRole(false);
    }
  };


  const handleSuperAdminTransferHost = async () => {
    if (!selectedMemberAction || selectedMemberAction.actionType !== "transfer" || !transferTargetId) return;
    setIsUpdatingRole(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/transfer-host`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          from_user_id: selectedMemberAction.id,
          to_user_id: transferTargetId
        })
      });
      if (response.ok) {
        await fetchData();
        setSelectedMemberAction(null);
        setTransferTargetId("");
      } else {
        const data = await response.json();
        alert(data.detail || "Unable to transfer host ownership.");
      }
    } catch (err) {
      console.error("Failed to transfer host ownership:", err);
    } finally {
      setIsUpdatingRole(false);
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}`, {
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

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    setIsSubmittingAnn(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title: annTitle, content: annContent })
      });
      if (res.ok) {
        const newAnn = await res.json();
        setAnnouncements((prev) => [newAnn, ...prev]);
        setAnnTitle("");
        setAnnContent("");
        setIsOpenAnnModal(false);
        alert("Announcement broadcasted successfully!");
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to create announcement.");
      }
    } catch (err) {
      console.error("Announcement error:", err);
    } finally {
      setIsSubmittingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/announcements/${annId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== annId));
        alert("Announcement deleted.");
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete announcement.");
      }
    } catch (err) {
      console.error("Delete announcement error:", err);
    }
  };

  const handleRegisterEvent = async (eventId: string) => {
    setIsRegistering(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${eventId}/register`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "waitlisted") {
          alert(`You have been added to the waitlist at position #${data.position}!`);
        } else {
          setRegisteredEvents((prev) => ({ ...prev, [eventId]: true }));
          setEventRegistrationsCount((prev) => ({ ...prev, [eventId]: (prev[eventId] || 0) + 1 }));
          alert("Successfully registered for this event!");
        }
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to register for event.");
      }
    } catch (err) {
      console.error("Register error:", err);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCancelRegistration = async (eventId: string) => {
    if (!confirm("Are you sure you want to cancel your registration?")) return;
    setIsRegistering(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${eventId}/register`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        setRegisteredEvents((prev) => ({ ...prev, [eventId]: false }));
        setEventRegistrationsCount((prev) => ({ ...prev, [eventId]: Math.max(0, (prev[eventId] || 1) - 1) }));
        alert("Registration successfully cancelled.");
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to cancel registration.");
      }
    } catch (err) {
      console.error("Cancel registration error:", err);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleTransferOwnership = async (targetUserId: string) => {
    if (!confirm("This action will make another member the host. Continue?")) return;
    setIsSubmittingTransfer(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/transfer-ownership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ target_user_id: targetUserId })
      });
      if (res.ok) {
        alert("Host ownership transferred successfully!");
        setIsOpenTransferModal(false);
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to transfer ownership.");
      }
    } catch (err) {
      console.error("Transfer ownership error:", err);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleLeaveCommunity = async () => {
    if (!confirm("Are you sure you want to leave this community?")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("You successfully left this community.");
        router.push("/dashboard");
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to leave community.");
      }
    } catch (err) {
      console.error("Leave community error:", err);
    }
  };

  const fetchChatMessages = async (silent = false) => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/chat/${chatChannel}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setChatMessages(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch chat messages:", err);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageContent.trim() || !token) return;
    setIsSendingChat(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/chat/${chatChannel}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ content: newMessageContent })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages((prev) => [...prev, newMsg]);
        setNewMessageContent("");
      }
    } catch (err) {
      console.error("Send chat message error:", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  const fetchCommunityLeaderboard = async () => {
    if (!token) return;
    setIsLeaderboardLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCommLeaderboard(await res.json());
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  const fetchGalleryData = async (silent = false) => {
    if (!token) return;
    if (!silent) setIsGalleryLoading(true);
    try {
      const [mediaRes, albumsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/media`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/albums`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (mediaRes.ok) setGalleryMedia(await mediaRes.json());
      if (albumsRes.ok) setGalleryAlbums(await albumsRes.json());
    } catch (err) {
      console.error("Gallery fetch error:", err);
    } finally {
      if (!silent) setIsGalleryLoading(false);
    }
  };

  const fetchHighlightsData = async (silent = false) => {
    if (!token) return;
    if (!silent) setIsHighlightsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/albums/highlights`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const albums = await res.json();
        const communityAlbums = albums.filter((a: any) => a.community_id === communityId);
        setHighlightsAlbums(communityAlbums);
      }

      if (canManageEcosystem) {
        const logsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/highlights/logs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (logsRes.ok) {
          setHighlightsLogs(await logsRes.json());
        }
      }
    } catch (err) {
      console.error("Highlights fetch error:", err);
    } finally {
      if (!silent) setIsHighlightsLoading(false);
    }
  };

  const handleViewHighlightsAlbum = async (album: any) => {
    setSelectedHighlightsAlbum(album);
    setIsHighlightsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/highlights/${album.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setHighlightsPhotos(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch highlights photos:", err);
    } finally {
      setIsHighlightsLoading(false);
    }
  };

  const handleGenerateCommunityHighlights = async (limitNum = 25) => {
    setIsGeneratingHighlights(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/generate-highlights?limit=${limitNum}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Community highlights generated successfully!");
        await fetchHighlightsData();
        setSelectedHighlightsAlbum(null);
      } else {
        alert(data.detail || "Failed to generate community highlights.");
      }
    } catch (err) {
      console.error("Failed to generate community highlights:", err);
    } finally {
      setIsGeneratingHighlights(false);
    }
  };

  const handleGenerateEventHighlights = async (eventId: string, limitNum = 25) => {
    setIsGeneratingHighlights(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${eventId}/generate-highlights?limit=${limitNum}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Event highlights generated successfully!");
        await fetchHighlightsData();
        setSelectedHighlightsAlbum(null);
      } else {
        alert(data.detail || "Failed to generate event highlights.");
      }
    } catch (err) {
      console.error("Failed to generate event highlights:", err);
    } finally {
      setIsGeneratingHighlights(false);
    }
  };

  const handleTogglePinCommunityMedia = async (media: any) => {
    const isPinned = media.is_pinned_highlight;
    const endpoint = isPinned ? "unpin" : "pin";
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/media/${media.id}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setGalleryMedia(prev => prev.map(m => m.id === media.id ? { ...m, is_pinned_highlight: !isPinned } : m));
        setHighlightsPhotos(prev => prev.map(m => m.id === media.id ? { ...m, is_pinned_highlight: !isPinned } : m));
      }
    } catch (err) {
      console.error("Pin media error:", err);
    }
  };

  const handleTogglePinEventPhoto = async (photoId: string, currentlyPinned: boolean) => {
    const endpoint = currentlyPinned ? "unpin" : "pin";
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/media/${photoId}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert(currentlyPinned ? "Event photo unpinned!" : "Event photo pinned!");
      }
    } catch (err) {
      console.error("Pin event photo error:", err);
    }
  };

  const handleOverrideAlbumCover = async (albumId: string, mediaId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/albums/${albumId}/cover?media_id=${mediaId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Cover updated successfully!");
        setHighlightsAlbums(prev => prev.map(a => a.id === albumId ? { ...a, cover_media_id: mediaId, cover_url: data.cover_url } : a));
        if (selectedHighlightsAlbum?.id === albumId) {
          setSelectedHighlightsAlbum((prev: any) => prev ? { ...prev, cover_media_id: mediaId, cover_url: data.cover_url } : null);
        }
      }
    } catch (err) {
      console.error("Cover selection error:", err);
    }
  };

  const handleMediaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/uploads/banner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { banner_url } = await uploadRes.json();
      const isVideo = file.type.startsWith("video");
      const mediaRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          file_url: banner_url,
          file_type: isVideo ? "video" : "photo",
          album_id: selectedAlbumFilter !== "all" ? selectedAlbumFilter : null
        })
      });
      if (mediaRes.ok) {
        const newMedia = await mediaRes.json();
        setGalleryMedia(prev => [newMedia, ...prev]);
      }
    } catch (err: any) {
      alert(err.message || "Failed to upload media");
    } finally {
      setIsUploadingMedia(false);
      e.target.value = "";
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim() || !token) return;
    setIsCreatingAlbum(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/albums`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newAlbumName, description: newAlbumDesc })
      });
      if (res.ok) {
        const newAlbum = await res.json();
        setGalleryAlbums(prev => [newAlbum, ...prev]);
        setNewAlbumName("");
        setNewAlbumDesc("");
        setShowAlbumModal(false);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to create album.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create album.");
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm("Delete this media item?") || !token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/media/${mediaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setGalleryMedia(prev => prev.filter(m => m.id !== mediaId));
        if (lightboxMedia?.id === mediaId) setLightboxMedia(null);
      }
    } catch (err) {
      console.error("Delete media error:", err);
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!confirm("Delete this album and all its media?") || !token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/albums/${albumId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setGalleryAlbums(prev => prev.filter(a => a.id !== albumId));
        setGalleryMedia(prev => prev.filter(m => m.album_id !== albumId));
        if (selectedAlbumFilter === albumId) setSelectedAlbumFilter("all");
      }
    } catch (err) {
      console.error("Delete album error:", err);
    }
  };

  const fetchEventComments = async () => {
    if (!selectedEvent || !token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/discussion`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEventComments(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch event comments:", err);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentContent.trim() || !selectedEvent || !token) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/discussion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ content: newCommentContent })
      });
      if (res.ok) {
        const newComm = await res.json();
        setEventComments((prev) => [...prev, newComm]);
        setNewCommentContent("");
      }
    } catch (err) {
      console.error("Failed to send comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const fetchEventSummary = async () => {
    if (!selectedEvent || !token) return;
    setIsSummaryLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEventSummary(await res.json());
      }
    } catch (err) {
      console.error("Summary fetch error:", err);
    } finally {
      setIsSummaryLoading(false);
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/search-users?q=${inviteSearchQuery}`, {
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

  // Phase 3 Chat Polling & Leaderboard/Comments Fetch Triggers
  useEffect(() => {
    if (activeTab === "chat") {
      fetchChatMessages(false);
      const interval = setInterval(() => fetchChatMessages(true), 4000); // Poll chat silently every 4 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab, chatChannel, communityId, token]);

  // ─── Tab-switch data fetch dispatcher ──────────────────────────────────────
  // Every More-menu tab (and primary tabs) that needs fresh data triggers its
  // fetch function here. This is the single source of truth for on-demand loads.
  useEffect(() => {
    if (activeTab === "leaderboard") {
      fetchCommunityLeaderboard();
    }
    if (activeTab === "gallery") {
      fetchGalleryData();
    }
    if (activeTab === "highlights") {
      fetchHighlightsData();
    }
    if (activeTab === "announcements") {
      fetchAnnouncements();
    }
    if (activeTab === "requests" && canManageEcosystem) {
      fetchJoinRequests();
    }
    if (activeTab === "analytics" && canManageEcosystem) {
      fetchCommunityStats();
    }
    if (activeTab === "members") {
      fetchCommunityMembers();
    }
  }, [activeTab, communityId, token]);

  // Phase 1 – Debug: confirm activeTab changes propagate correctly
  useEffect(() => {
    console.log("ACTIVE TAB CHANGED:", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventComments();
      // Fetch AI summary only if the event date has already passed
      const eventDateObj = new Date(selectedEvent.date);
      const today = new Date();
      // Reset times to compare dates accurately
      eventDateObj.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      if (eventDateObj <= today) {
        fetchEventSummary();
      } else {
        setEventSummary(null);
      }
    }
  }, [selectedEvent, token]);

  const fetchSelectedEventDetails = async () => {
    if (!selectedEvent || !token) return;
    setIsEventStatsLoading(true);
    try {
      const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (statsRes.ok) {
        setSelectedEventStats(await statsRes.json());
      }
      
      const partsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/participants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (partsRes.ok) {
        setSelectedEventParticipants(await partsRes.json());
      }
      
      const wlRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/waitlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (wlRes.ok) {
        setSelectedEventWaitlist(await wlRes.json());
      }
    } catch (err) {
      console.error("Error loading selected event details:", err);
    } finally {
      setIsEventStatsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEvent) {
      fetchSelectedEventDetails();
      setEventDetailTab("upload");
    }
  }, [selectedEvent]);

  const handleRemoveParticipant = async (userId: string) => {
    if (!selectedEvent || !confirm("Are you sure you want to remove this participant?")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/participants/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Participant removed successfully.");
        await fetchSelectedEventDetails();
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to remove participant.");
      }
    } catch (err) {
      console.error("Remove participant error:", err);
    }
  };

  const handlePromoteUser = async (userId: string) => {
    if (!selectedEvent || !confirm("Are you sure you want to manually promote this user from the waitlist?")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/waitlist/promote/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("User promoted to registered successfully.");
        await fetchSelectedEventDetails();
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to promote user.");
      }
    } catch (err) {
      console.error("Promote user error:", err);
    }
  };

  const handleExportRegistry = async (format: "csv" | "xlsx") => {
    if (!selectedEvent || !token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event_${selectedEvent.id}_registrations.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Export ${format} error:`, err);
      alert("Failed to export registrations. Please try again.");
    }
  };

  const handleSendInvitation = async (username: string) => {
    setInviteSuccessMsg("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/invitations`, {
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

  const handlePublishEvent = async (eventId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${eventId}/publish`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Event published successfully.");
        await fetchData();
        if (selectedEvent && selectedEvent.id === eventId) {
          await fetchSelectedEventDetails();
        }
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to publish event.");
      }
    } catch (err) {
      console.error("Publish event error:", err);
      alert("Failed to publish event.");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-white/[0.04] border-white/[0.12] text-gray-400",
      published: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
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
            <Users className="w-4 h-4 text-primary" />
            <span>My Communities</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/timeline")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Activity className="w-4 h-4 text-secondary" />
            <span>Personal Timeline</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/my-photos")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Camera className="w-4 h-4 text-primary" />
            <span>My Photos</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/chat")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>Private Chat</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/search")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Search className="w-4 h-4 text-cyan-400" />
            <span>Smart Search</span>
          </button>
          <button
            onClick={handleLeaveCommunity}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 text-red-500/70" />
            <span>Leave Workspace</span>
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
            {activeTab === "events" && !selectedEvent && canCreateEvents && (
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
                  <img src={getOptimizedImageUrl(community.banner_url, 1200)} alt="" className="w-full h-full object-cover" loading="lazy" />
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
              <div className="w-full border-b border-white/[0.06] pb-1 md:overflow-visible overflow-x-auto scrollbar-none">
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

                  <button
                    onClick={() => setActiveTab("highlights")}
                    className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                      activeTab === "highlights" ? "text-primary" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span>✨ AI Highlights</span>
                    {activeTab === "highlights" && (
                      <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_#06b6d4]"></motion.div>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab("members")}
                    className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                      activeTab === "members" ? "text-primary" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span>Community Directory</span>
                    {activeTab === "members" && (
                      <motion.div layoutId="tab-underline-private" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary"></motion.div>
                    )}
                  </button>

                  <CommunityMoreMenu
                    currentUserRole={currentUserRole as any}
                    activeTab={activeTab}
                    setActiveTab={(tab: string) => {
                      console.log("ACTIVE TAB (parent setActiveTab):", tab);
                      setActiveTab(tab as any);
                    }}
                    isElevated={isElevated}
                  />
                </div>
              </div>

              {/* TAB CONTENTS */}
              <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="flex-grow flex flex-col"
              >
                
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
                        <div className="flex flex-col gap-6">
                          {/* Event Category & Status Filters (Module 17) */}
                          <div className="flex flex-wrap gap-4 items-center justify-between border-b border-white/[0.06] pb-4">
                            <div className="flex flex-wrap items-center gap-1 bg-white/[0.01] border border-white/[0.05] p-1 rounded-xl">
                              {["all", "Workshop", "Seminar", "Photography Walk", "Hackathon", "Competition", "Meetup", "Guest Lecture", "Exhibition", "Club Activity", "Other"].map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setEventCategoryFilter(cat)}
                                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                    eventCategoryFilter === cat
                                      ? "bg-primary text-black"
                                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                                  }`}
                                >
                                  {cat === "all" ? "All Categories" : cat}
                                </button>
                              ))}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Filter:</span>
                              <select
                                value={eventStatusFilter}
                                onChange={(e) => setEventStatusFilter(e.target.value)}
                                className="bg-black/50 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/30"
                              >
                                <option value="all" className="bg-gray-900">All Statuses</option>
                                <option value="open" className="bg-gray-900">Open Registration</option>
                                <option value="full" className="bg-gray-900">Full Events</option>
                                <option value="registered" className="bg-gray-900">Registered Events</option>
                              </select>
                            </div>
                          </div>

                          {filteredEvents.length === 0 ? (
                            <div className="p-16 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-2 py-20 flex-grow w-full">
                              <Calendar className="w-8 h-8 text-gray-400/20" />
                              <span className="text-sm font-bold text-gray-200">No events matched your filters</span>
                              <span className="text-xs text-gray-400 max-w-sm">Try adjusting your category pills or status select.</span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {filteredEvents.map((event) => {
                                const regs = eventRegistrationsCount[event.id] || 0;
                                const maxPart = event.max_participants || 0;
                                const fillPct = maxPart > 0 ? Math.min(100, (regs / maxPart) * 100) : 0;
                                const seatsLeft = maxPart > 0 ? Math.max(0, maxPart - regs) : 0;
                                const deadlineText = getDeadlineText(event.registration_deadline);

                                return (
                                  <motion.div
                                    whileHover={{ y: -4 }}
                                    key={event.id}
                                    onClick={() => setSelectedEvent(event)}
                                    className="p-6 rounded-2xl glass-panel border border-white/[0.06] hover:border-primary/30 cursor-pointer flex flex-col justify-between transition-all duration-300 group min-h-[180px]"
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className={`text-[8px] px-2 py-0.5 rounded-full border text-center font-bold uppercase tracking-wider ${getStatusBadge(event.status)}`}>
                                            {event.status}
                                          </span>
                                          {event.category && (
                                            <span className="text-[8px] px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-center font-bold uppercase tracking-wider">
                                              {event.category}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          {deadlineText && (
                                            <span className="text-[8px] font-bold text-gray-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] shrink-0">
                                              {deadlineText}
                                            </span>
                                          )}
                                          {(user?.platform_role === "super_admin" || user?.platform_role === "admin" || user?.id === event.creator_id) && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                confirmDeleteEvent(event.id, event.title);
                                              }}
                                              className="p-1 rounded-lg hover:bg-white/5 transition-all text-red-500 hover:text-red-400 z-10 shrink-0"
                                              aria-label={`Delete ${event.title}`}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <h3 className="text-sm font-bold text-white mt-4 group-hover:text-primary transition-colors font-display truncate">
                                        {event.title}
                                      </h3>
                                      <p className="mt-2 text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                        {event.description}
                                      </p>
                                    </div>
                                    
                                    <div className="mt-4 space-y-2">
                                      {maxPart > 0 && (
                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[9px] font-bold">
                                            <span className="text-gray-400">█████████░ {fillPct.toFixed(0)}%</span>
                                            {regs >= maxPart ? (
                                              <span className="text-secondary font-extrabold flex items-center gap-1">⛔ Event Full</span>
                                            ) : fillPct >= 95 ? (
                                              <span className="text-secondary font-extrabold flex items-center gap-1 animate-pulse">🔥 Almost Full</span>
                                            ) : fillPct >= 80 ? (
                                              <span className="text-amber-400 font-bold flex items-center gap-1">⚠ {seatsLeft} Left</span>
                                            ) : (
                                              <span className="text-emerald-400 font-medium">{seatsLeft} Seats Left</span>
                                            )}
                                          </div>
                                          <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all duration-300 ${
                                                regs >= maxPart ? "bg-red-500" :
                                                fillPct >= 95 ? "bg-orange-500" :
                                                fillPct >= 80 ? "bg-amber-400" : "bg-primary"
                                              }`}
                                              style={{ width: `${fillPct}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-2 justify-between items-center text-[10px] pt-1">
                                        <span className="text-gray-400 font-mono">
                                          Regs: {regs} {maxPart > 0 ? `/ ${maxPart}` : ""}
                                        </span>
                                        {event.status === 'draft' ? (
                                          <span className="text-gray-500 font-bold italic">Draft Event</span>
                                        ) : registeredEvents[event.id] ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCancelRegistration(event.id);
                                            }}
                                            disabled={isRegistering}
                                            className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500 hover:text-black transition-all"
                                          >
                                            Registered ✓
                                          </button>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRegisterEvent(event.id);
                                            }}
                                            disabled={isRegistering}
                                            className="px-2.5 py-1 rounded bg-primary text-black font-bold hover:bg-white transition-all"
                                          >
                                            Register Event
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-gray-400">
                                      <span className="flex items-center gap-1.5 truncate max-w-[150px]"><MapPin className="w-3.5 h-3.5 text-primary shrink-0" />{event.location}</span>
                                      <span className="flex items-center gap-1.5 shrink-0"><Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />{event.date}</span>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
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
                              <img src={getOptimizedImageUrl((selectedEvent as any).banner_url || (selectedEvent as any).cover_url, 1200)} alt="" className="w-full h-full object-cover" loading="lazy" />
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

                          <div className="absolute top-44 right-6 flex items-center gap-2">
                            {isElevated && selectedEvent.status === 'draft' && (
                              <button
                                onClick={() => handlePublishEvent(selectedEvent.id)}
                                className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-600 transition-colors"
                              >
                                Publish Event
                              </button>
                            )}
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

                        {/* Host Metrics Deck */}
                        {isElevated && (
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 rounded-xl glass-panel border border-white/[0.06] bg-[#0a0f1a]/40 text-center relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Capacity</span>
                              <span className="text-xl font-extrabold text-white mt-1 block">
                                {selectedEventStats?.capacity ?? selectedEvent.max_participants ?? "∞"}
                              </span>
                            </div>
                            <div className="p-4 rounded-xl glass-panel border border-white/[0.06] bg-[#0a0f1a]/40 text-center relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Registered</span>
                              <span className="text-xl font-extrabold text-emerald-400 mt-1 block">
                                {selectedEventStats?.registered ?? eventRegistrationsCount[selectedEvent.id] ?? 0}
                              </span>
                            </div>
                            <div className="p-4 rounded-xl glass-panel border border-white/[0.06] bg-[#0a0f1a]/40 text-center relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Waitlisted</span>
                              <span className="text-xl font-extrabold text-amber-400 mt-1 block">
                                {selectedEventStats?.waitlisted ?? selectedEventWaitlist.length ?? 0}
                              </span>
                            </div>
                            <div className="p-4 rounded-xl glass-panel border border-white/[0.06] bg-[#0a0f1a]/40 text-center relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Seats Available</span>
                              <span className="text-xl font-extrabold text-cyan-400 mt-1 block">
                                {selectedEventStats ? selectedEventStats.seats_left : (selectedEvent.max_participants ? Math.max(0, selectedEvent.max_participants - (eventRegistrationsCount[selectedEvent.id] || 0)) : "Unlimited")}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Curation Sub-tabs */}
                        {isElevated && (
                          <div className="flex border-b border-white/[0.06] gap-2 mb-6 overflow-x-auto scrollbar-none">
                            <button
                              onClick={() => setEventDetailTab("upload")}
                              className={`px-4 py-2.5 text-xs font-bold transition-all relative shrink-0 ${
                                eventDetailTab === "upload" ? "text-primary" : "text-gray-400 hover:text-white"
                              }`}
                            >
                              <span>Upload & Discussion</span>
                              {eventDetailTab === "upload" && (
                                <motion.div layoutId="subtab-underline" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_#06b6d4]"></motion.div>
                              )}
                            </button>
                            <button
                              onClick={() => setEventDetailTab("participants")}
                              className={`px-4 py-2.5 text-xs font-bold transition-all relative shrink-0 ${
                                eventDetailTab === "participants" ? "text-primary" : "text-gray-400 hover:text-white"
                              }`}
                            >
                              <span>Participants ({selectedEventParticipants.length})</span>
                              {eventDetailTab === "participants" && (
                                <motion.div layoutId="subtab-underline" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_#06b6d4]"></motion.div>
                              )}
                            </button>
                            <button
                              onClick={() => setEventDetailTab("waitlist")}
                              className={`px-4 py-2.5 text-xs font-bold transition-all relative shrink-0 ${
                                eventDetailTab === "waitlist" ? "text-primary" : "text-gray-400 hover:text-white"
                              }`}
                            >
                              <span>Waitlist Queue ({selectedEventWaitlist.length})</span>
                              {eventDetailTab === "waitlist" && (
                                <motion.div layoutId="subtab-underline" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_#06b6d4]"></motion.div>
                              )}
                            </button>
                            <button
                              onClick={() => setEventDetailTab("analytics")}
                              className={`px-4 py-2.5 text-xs font-bold transition-all relative shrink-0 ${
                                eventDetailTab === "analytics" ? "text-primary" : "text-gray-400 hover:text-white"
                              }`}
                            >
                              <span>Analytics & Export</span>
                              {eventDetailTab === "analytics" && (
                                <motion.div layoutId="subtab-underline" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_#06b6d4]"></motion.div>
                              )}
                            </button>
                          </div>
                        )}

                        {/* TAB CONTENTS */}
                        {(isElevated ? eventDetailTab : "upload") === "upload" && (
                          <div className="space-y-6">
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

                            {/* AI EVENT SUMMARY DISPLAY */}
                            {eventSummary && (
                              <div className="p-6 rounded-2xl glass-panel border border-primary/20 bg-primary/[0.02] space-y-4">
                                <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Event Retrospective Summary</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] text-center">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Participants RSVP</span>
                                    <span className="text-xl font-extrabold text-white mt-1 block">{eventSummary.participants}</span>
                                  </div>

                                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] text-center">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Photos Uploaded</span>
                                    <span className="text-xl font-extrabold text-primary mt-1 block">{eventSummary.photos_uploaded}</span>
                                  </div>
                                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] text-center">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Top Contributor</span>
                                    <span className="text-sm font-extrabold text-white mt-2 block">@{eventSummary.top_contributor}</span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed italic bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                                  "{eventSummary.highlights}"
                                </p>
                              </div>
                            )}

                            {/* EVENT DISCUSSION THREAD BOARD */}
                            <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] bg-[#0a0f1a]/30 space-y-6">
                              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                                <Users className="w-4 h-4 text-primary" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Event Q&A and Feedback</h3>
                              </div>

                              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-none">
                                {eventComments.length === 0 ? (
                                  <div className="py-8 text-center text-gray-500 text-xs">
                                    No questions or comments posted for this event yet.
                                  </div>
                                ) : (
                                  eventComments.map((comm) => (
                                    <div key={comm.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-2.5">
                                      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary uppercase flex-shrink-0">
                                        {comm.user?.full_name?.charAt(0) || "?"}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-1.5 text-[9px] font-semibold text-gray-400">
                                          <span>@{comm.user?.username || "user"}</span>
                                          <span>•</span>
                                          <span>{new Date(comm.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-200 mt-1 leading-relaxed">{comm.content}</p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* Add comment input */}
                              <form onSubmit={handleSendComment} className="flex gap-2 pt-2 border-t border-white/[0.06]">
                                <input
                                  type="text"
                                  required
                                  value={newCommentContent}
                                  onChange={(e) => setNewCommentContent(e.target.value)}
                                  placeholder="Ask a question or leave event feedback..."
                                  className="flex-grow px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all"
                                />
                                <button
                                  type="submit"
                                  disabled={isSubmittingComment}
                                  className="px-4 py-2.5 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold transition-all disabled:opacity-50"
                                >
                                  {isSubmittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Post"}
                                </button>
                              </form>
                            </div>
                          </div>
                        )}

                        {isElevated && eventDetailTab === "participants" && (
                          <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Registered Participants</h3>
                              </div>
                              <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input
                                  type="text"
                                  value={participantSearchQuery}
                                  onChange={(e) => setParticipantSearchQuery(e.target.value)}
                                  placeholder="Search by name or username..."
                                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all"
                                />
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs text-gray-400">
                                <thead>
                                  <tr className="border-b border-white/[0.06] text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                                    <th className="py-3 px-4">Name</th>
                                    <th className="py-3 px-4">Email</th>
                                    <th className="py-3 px-4">Registered Date</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                  {selectedEventParticipants
                                    .filter((p: any) => {
                                      const q = participantSearchQuery.toLowerCase();
                                      return !q ||
                                        (p.user?.full_name || "").toLowerCase().includes(q) ||
                                        (p.user?.username || "").toLowerCase().includes(q) ||
                                        (p.user?.email || "").toLowerCase().includes(q);
                                    })
                                    .map((p: any) => (
                                      <tr key={p.id} className="hover:bg-white/[0.01] transition-all">
                                        <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2.5">
                                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-primary">
                                            {p.user?.full_name?.charAt(0) || "?"}
                                          </div>
                                          <div>
                                            <span className="block">{p.user?.full_name}</span>
                                            <span className="text-[10px] text-gray-500">@{p.user?.username}</span>
                                          </div>
                                        </td>
                                        <td className="py-3.5 px-4">{p.user?.email}</td>
                                        <td className="py-3.5 px-4">{new Date(p.created_at).toLocaleDateString()}</td>
                                        <td className="py-3.5 px-4 text-right">
                                          <button
                                            onClick={() => handleRemoveParticipant(p.user_id)}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-all font-bold"
                                            title="Remove Participant"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  {selectedEventParticipants.length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="py-8 text-center text-gray-500">
                                        No participants registered for this event yet.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {isElevated && eventDetailTab === "waitlist" && (
                          <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
                            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Waitlist Queue</h3>
                              </div>
                              <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider font-mono">
                                Ordered by Queue Position
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs text-gray-400">
                                <thead>
                                  <tr className="border-b border-white/[0.06] text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                                    <th className="py-3 px-4">Queue Position</th>
                                    <th className="py-3 px-4">Name</th>
                                    <th className="py-3 px-4">Email</th>
                                    <th className="py-3 px-4">Joined Waitlist</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                  {selectedEventWaitlist
                                    .sort((a: any, b: any) => a.position - b.position)
                                    .map((wl: any) => (
                                      <tr key={wl.id} className="hover:bg-white/[0.01] transition-all">
                                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                                          #{wl.position}
                                        </td>
                                        <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2.5">
                                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400/10 to-amber-600/10 border border-amber-400/20 flex items-center justify-center text-[10px] font-bold text-amber-400">
                                            {wl.user?.full_name?.charAt(0) || "?"}
                                          </div>
                                          <div>
                                            <span className="block">{wl.user?.full_name}</span>
                                            <span className="text-[10px] text-gray-500">@{wl.user?.username}</span>
                                          </div>
                                        </td>
                                        <td className="py-3.5 px-4">{wl.user?.email}</td>
                                        <td className="py-3.5 px-4">{new Date(wl.created_at).toLocaleDateString()}</td>
                                        <td className="py-3.5 px-4 text-right">
                                          <div className="flex justify-end gap-2">
                                            <button
                                              onClick={() => handlePromoteUser(wl.user_id)}
                                              className="px-2.5 py-1 rounded-lg bg-primary hover:bg-white text-black text-[10px] font-bold transition-all shadow-[0_0_10px_rgba(0,229,255,0.1)]"
                                            >
                                              Promote User
                                            </button>
                                            <button
                                              onClick={() => handleRemoveParticipant(wl.user_id)}
                                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-all font-bold"
                                              title="Remove Waitlist User"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  {selectedEventWaitlist.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="py-8 text-center text-gray-500">
                                        No users currently on the waitlist.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {isElevated && eventDetailTab === "analytics" && (
                          <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] space-y-6">
                            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                              <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Registration & Capacity Analytics</h3>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Visual representation card */}
                              <div className="p-6 rounded-xl bg-black/40 border border-white/[0.06] space-y-4">
                                <h4 className="text-xs font-bold text-white">Ecosystem Fill Rate</h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Total Progress</span>
                                    <span className="font-bold text-white">{selectedEventStats?.fill_rate ?? 0}%</span>
                                  </div>
                                  <div className="w-full h-3 bg-white/[0.04] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        (selectedEventStats?.fill_rate ?? 0) >= 95 ? "bg-gradient-to-r from-orange-500 to-red-500 animate-pulse" :
                                        (selectedEventStats?.fill_rate ?? 0) >= 80 ? "bg-amber-400" : "bg-gradient-to-r from-primary to-emerald-400"
                                      }`}
                                      style={{ width: `${selectedEventStats?.fill_rate ?? 0}%` }}
                                    ></div>
                                  </div>
                                  <div className="text-[10px] text-gray-505 pt-1 leading-relaxed">
                                    Shows percentage of available slots currently filled by active registrations. If the event is full, waitlists are automatically generated and queued sequentially.
                                  </div>
                                </div>
                              </div>

                              <div className="p-6 rounded-xl bg-black/40 border border-white/[0.06] space-y-4">
                                <h4 className="text-xs font-bold text-white">Ecosystem Health & Cancellations</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                    <span className="text-[9px] font-bold text-gray-550 block uppercase tracking-wider">Cancellation Rate</span>
                                    <span className="text-lg font-extrabold text-red-400 mt-0.5 block">{selectedEventStats?.cancellation_rate ?? 0}%</span>
                                  </div>
                                  <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                    <span className="text-[9px] font-bold text-gray-550 block uppercase tracking-wider">Dropout Rate</span>
                                    <span className="text-lg font-extrabold text-gray-400 mt-0.5 block">{selectedEventStats?.dropout_rate ?? 0}%</span>
                                  </div>
                                </div>
                                <p className="text-[10px] text-gray-505 leading-normal">
                                  Cancellation rates capture dropouts after initial registration. When a participant cancels, FaceSnap's auto-promotion system shifts the queue positions instantly.
                                </p>
                              </div>
                            </div>

                            {/* Export controls footer */}
                            <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div>
                                <h4 className="text-xs font-bold text-white">Registry Export Utilities</h4>
                                <p className="text-[10px] text-gray-400">Stream fully indexed csv or styled openpyxl excel databases.</p>
                              </div>
                              <div className="flex gap-3 w-full sm:w-auto">
                                <button
                                  onClick={() => handleExportRegistry("csv")}
                                  className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-xs font-bold text-white transition-all"
                                >
                                  <span>Export CSV</span>
                                </button>
                                <button
                                  onClick={() => handleExportRegistry("xlsx")}
                                  className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,229,255,0.15)]"
                                >
                                  <span>Export Excel</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )}

                {/* 2. PRIVATE GALLERY TAB */}
                {activeTab === "gallery" && (
                  <div className="flex flex-col gap-6 flex-grow">
                    {/* Gallery Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-white font-display">Community Media Gallery</h3>
                        <span className="text-[9px] text-gray-400 px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.02] font-bold ml-1">
                          {galleryMedia.length} items
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManageEcosystem && (
                          <button
                            onClick={() => setShowAlbumModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-primary/30 text-xs font-bold text-gray-300 hover:text-white transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>New Album</span>
                          </button>
                        )}
                        <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold cursor-pointer transition-all shadow-[0_0_15px_rgba(0,229,255,0.15)]">
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>{isUploadingMedia ? "Uploading..." : "Upload Media"}</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            disabled={isUploadingMedia}
                            onChange={handleMediaFileUpload}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Sub-tab Navigation: Photos / Videos / Albums */}
                    <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.06] p-1 rounded-xl w-fit">
                      {(["photos", "videos", "albums"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setGalleryTab(t)}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg capitalize transition-all ${
                            galleryTab === t
                              ? "bg-primary text-black shadow-[0_0_10px_rgba(0,229,255,0.2)]"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {/* Album filter pills - show in photos/videos sub-tab */}
                    {galleryTab !== "albums" && galleryAlbums.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setSelectedAlbumFilter("all")}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            selectedAlbumFilter === "all"
                              ? "bg-primary border-primary text-black"
                              : "border-white/[0.08] text-gray-400 hover:text-white hover:border-white/20"
                          }`}
                        >
                          All
                        </button>
                        {galleryAlbums.map((album) => (
                          <button
                            key={album.id}
                            onClick={() => setSelectedAlbumFilter(album.id)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                              selectedAlbumFilter === album.id
                                ? "bg-primary border-primary text-black"
                                : "border-white/[0.08] text-gray-400 hover:text-white hover:border-white/20"
                            }`}
                          >
                            {album.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Loading State */}
                    {isGalleryLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-xs text-gray-400 tracking-widest uppercase font-bold">Loading gallery...</span>
                      </div>
                    ) : galleryTab === "albums" ? (
                      /* ALBUMS VIEW */
                      galleryAlbums.length === 0 ? (
                        <div className="p-16 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-4 py-24">
                          <ImageIcon className="w-10 h-10 text-gray-400/20" />
                          <span className="text-sm font-bold text-gray-200">No albums created yet</span>
                          <span className="text-xs text-gray-400 max-w-sm -mt-2">
                            {canManageEcosystem ? "Create your first album to organize community media." : "Admins haven't created any albums yet."}
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {galleryAlbums.map((album) => (
                            <motion.div
                              whileHover={{ y: -3 }}
                              key={album.id}
                              onClick={() => { setSelectedAlbumFilter(album.id); setGalleryTab("photos"); }}
                              className="group relative p-5 rounded-2xl glass-panel border border-white/[0.06] hover:border-primary/30 cursor-pointer flex flex-col gap-3 transition-all duration-300"
                            >
                              {/* Album cover gradient */}
                              <div className="w-full h-28 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/[0.06] flex items-center justify-center overflow-hidden">
                                {album.cover_url ? (
                                  <img src={getOptimizedImageUrl(album.cover_url, 300)} alt={album.name} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="grid grid-cols-2 gap-1 p-2 w-full h-full">
                                    {galleryMedia.filter(m => m.album_id === album.id).slice(0, 4).map((m: any) => (
                                      <img key={m.id} src={getOptimizedImageUrl(m.file_url, 150)} alt="" className="w-full h-full object-cover rounded-lg" loading="lazy" />
                                    ))}
                                    {galleryMedia.filter(m => m.album_id === album.id).length === 0 && (
                                      <div className="col-span-2 flex items-center justify-center h-full">
                                        <ImageIcon className="w-8 h-8 text-gray-400/20" />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors font-display">{album.name}</h4>
                                {album.description && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{album.description}</p>}
                                <span className="text-[9px] text-gray-500 mt-1 block">{album.media_count || 0} items · by @{album.creator?.username || "admin"}</span>
                              </div>
                              {canManageEcosystem && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album.id); }}
                                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )
                    ) : (
                      /* PHOTOS / VIDEOS MASONRY GRID VIEW */
                      (() => {
                        const filtered = galleryMedia.filter(m => {
                          const typeMatch = galleryTab === "photos" ? m.file_type === "photo" : m.file_type === "video";
                          const albumMatch = selectedAlbumFilter === "all" || m.album_id === selectedAlbumFilter;
                          return typeMatch && albumMatch;
                        });
                        return filtered.length === 0 ? (
                          <div className="p-16 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-4 py-24">
                            <ImageIcon className="w-10 h-10 text-gray-400/20" />
                            <span className="text-sm font-bold text-gray-200">
                              No {galleryTab} uploaded yet
                            </span>
                            <span className="text-xs text-gray-400 max-w-sm -mt-2">
                              Upload {galleryTab === "photos" ? "photos" : "videos"} using the button above.
                            </span>
                          </div>
                        ) : (
                          /* CSS Columns masonry grid */
                          <div
                            style={{
                              columnCount: 3,
                              columnGap: "12px",
                            } as React.CSSProperties}
                            className="w-full"
                          >
                            {filtered.map((media: any) => (
                              <motion.div
                                key={media.id}
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.01 }}
                                style={{ breakInside: "avoid", marginBottom: "12px" }}
                                className="group relative rounded-xl overflow-hidden border border-white/[0.06] hover:border-primary/40 cursor-pointer transition-all duration-300 shadow-lg"
                                onClick={() => setLightboxMedia(media)}
                              >
                                {media.overall_score > 0 && (
                                  <div className="absolute top-2.5 left-2.5 z-10 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/[0.08] text-[9px] font-bold text-white flex items-center gap-1 group/badge pointer-events-auto">
                                    <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                                    <span>{Math.round(media.overall_score)}% AI Score</span>
                                    <div className="absolute left-0 top-full mt-1.5 w-44 p-3 rounded-xl bg-[#0a0f1a]/95 backdrop-blur-xl border border-white/[0.1] shadow-2xl opacity-0 scale-95 group-hover/badge:opacity-100 group-hover/badge:scale-100 transition-all duration-200 origin-top-left pointer-events-none z-20 space-y-1.5 text-[9px]">
                                      <div className="font-extrabold text-primary border-b border-white/[0.08] pb-1 uppercase tracking-wider">Quality Breakdown</div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Sharpness:</span>
                                        <span className="font-bold text-white">{Math.round(media.sharpness_score)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Centering:</span>
                                        <span className="font-bold text-white">{Math.round(media.composition_score)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Lighting:</span>
                                        <span className="font-bold text-white">{Math.round(media.brightness_score)}%</span>
                                      </div>
                                      {media.face_visibility_score > 0 && (
                                        <>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Face Visibility:</span>
                                            <span className="font-bold text-white">{Math.round(media.face_visibility_score)}%</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Smile:</span>
                                            <span className="font-bold text-white">{Math.round(media.smile_score)}%</span>
                                          </div>
                                        </>
                                      )}
                                      {media.quality_reason && (
                                        <div className="pt-1.5 border-t border-white/[0.06] text-gray-400 italic font-medium leading-normal">
                                          "{media.quality_reason}"
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {canManageEcosystem && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePinCommunityMedia(media);
                                    }}
                                    className={`absolute top-2.5 right-2.5 z-10 p-1.5 rounded-lg backdrop-blur-md border transition-all ${
                                      media.is_pinned_highlight
                                        ? "bg-primary/20 border-primary/40 text-primary"
                                        : "bg-black/60 border-white/[0.08] text-gray-400 hover:text-white"
                                    }`}
                                    title={media.is_pinned_highlight ? "Pinned highlight" : "Pin to highlights"}
                                  >
                                    <Plus className={`w-3.5 h-3.5 ${media.is_pinned_highlight ? "rotate-45" : ""}`} />
                                  </button>
                                )}
                                {media.file_type === "video" ? (
                                  <div className="relative bg-black/40">
                                    <video
                                      src={media.file_url}
                                      className="w-full h-auto block"
                                      muted
                                      playsInline
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="w-10 h-10 rounded-full bg-black/70 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                        <span className="text-white text-lg">▶</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <img
                                    src={getOptimizedImageUrl(media.file_url, 300)}
                                    alt={media.title || ""}
                                    className="w-full h-auto block"
                                    loading="lazy"
                                  />
                                )}
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
                                  {media.title && (
                                    <span className="text-xs font-bold text-white truncate">{media.title}</span>
                                  )}
                                  <span className="text-[9px] text-gray-300 mt-0.5">@{media.uploader?.username || "user"} · {getTimeAgo(media.created_at)}</span>
                                  {(canManageEcosystem || media.uploaded_by === user?.id) && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteMedia(media.id); }}
                                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-gray-400 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* Lightbox Modal for Gallery */}
                <AnimatePresence>
                  {lightboxMedia && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
                      onClick={() => setLightboxMedia(null)}
                    >
                      <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.95 }}
                        className="relative max-w-5xl w-full max-h-[90vh] flex flex-col gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setLightboxMedia(null)}
                          className="absolute -top-10 right-0 p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        {lightboxMedia.file_type === "video" ? (
                          <video
                            src={lightboxMedia.file_url}
                            controls
                            autoPlay
                            className="w-full max-h-[80vh] rounded-2xl object-contain border border-white/[0.08]"
                          />
                        ) : (
                          <img
                            src={getOptimizedImageUrl(lightboxMedia.file_url, 800)}
                            alt={lightboxMedia.title || ""}
                            className="w-full max-h-[80vh] rounded-2xl object-contain border border-white/[0.08]"
                          />
                        )}
                        <div className="flex items-center justify-between px-2">
                          <div>
                            {lightboxMedia.title && <p className="text-sm font-bold text-white">{lightboxMedia.title}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">Uploaded by @{lightboxMedia.uploader?.username || "user"} · {getTimeAgo(lightboxMedia.created_at)}</p>
                          </div>
                          {(canManageEcosystem || lightboxMedia.uploaded_by === user?.id) && (
                            <button
                              onClick={() => handleDeleteMedia(lightboxMedia.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-xs font-bold transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Create Album Modal */}
                <AnimatePresence>
                  {showAlbumModal && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
                      onClick={() => setShowAlbumModal(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-[#0a0f1a] border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button onClick={() => setShowAlbumModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                          <X className="w-4 h-4" />
                        </button>
                        <h3 className="text-sm font-bold text-white font-display mb-4">Create New Album</h3>
                        <form onSubmit={handleCreateAlbum} className="flex flex-col gap-3">
                          <input
                            type="text"
                            required
                            value={newAlbumName}
                            onChange={(e) => setNewAlbumName(e.target.value)}
                            placeholder="Album name..."
                            className="px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-sm text-white placeholder-gray-600 transition-all"
                          />
                          <textarea
                            value={newAlbumDesc}
                            onChange={(e) => setNewAlbumDesc(e.target.value)}
                            placeholder="Description (optional)..."
                            rows={2}
                            className="px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-sm text-white placeholder-gray-600 transition-all resize-none"
                          />
                          <button
                            type="submit"
                            disabled={isCreatingAlbum}
                            className="w-full py-3 rounded-xl bg-primary hover:bg-white text-black text-sm font-bold transition-all disabled:opacity-50"
                          >
                            {isCreatingAlbum ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Album"}
                          </button>
                        </form>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* announcements TAB */}
                {activeTab === "announcements" && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-white font-display">Community Broadcasts</h3>
                      </div>
                      {canManageEcosystem && (
                        <button
                          onClick={() => setIsOpenAnnModal(true)}
                          className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-primary text-black hover:bg-white text-xs font-bold transition-all shadow-lg"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Publish Announcement</span>
                        </button>
                      )}
                    </div>

                    {isAnnouncementsLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        <span className="text-xs text-gray-500 font-semibold">Loading announcements...</span>
                      </div>
                    ) : announcements.length === 0 ? (
                      <div className="p-16 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-4 py-24 flex-grow w-full">
                        <Bell className="w-10 h-10 text-gray-400/20 animate-bounce" />
                        <span className="text-sm font-bold text-gray-200">No announcements posted</span>
                        <span className="text-xs text-gray-400 max-w-sm -mt-2">
                          Group administrators haven't dispatched any updates to the community channel yet.
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {announcements.map((ann) => (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={ann.id}
                            className="p-6 rounded-2xl glass-panel border border-white/[0.06] hover:border-primary/20 transition-all duration-300 relative group"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-sm font-bold text-white font-display flex items-center gap-2">
                                  <span>📢 {ann.title}</span>
                                </h4>
                                <p className="text-xs text-gray-300 mt-2 leading-relaxed whitespace-pre-line">
                                  {ann.content}
                                </p>
                              </div>
                              {(user?.platform_role === "super_admin" || user?.id === ann.created_by || canManageEcosystem) && (
                                <button
                                  onClick={() => handleDeleteAnnouncement(ann.id)}
                                  className="p-2 rounded-xl hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                  title="Delete Announcement"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[9px] text-gray-400 font-semibold">
                              <span>Posted by: @{ann.creator?.username || "Admin"}</span>
                              <span>{new Date(ann.created_at).toLocaleString()}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* COMMUNITY Chat TAB */}
                {activeTab === "chat" && (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow min-h-[500px]">
                    {/* Channels sidebar */}
                    <div className="lg:col-span-1 p-4 rounded-2xl glass-panel border border-white/[0.06] flex flex-col gap-2 bg-[#0a0f1a]/60">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Chat Channels</span>
                      {["general", "events", "media", "announcements", "photography"].map((chan) => (
                        <button
                          key={chan}
                          onClick={() => { setChatChannel(chan); }}
                          className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                            chatChannel === chan
                              ? "bg-primary text-black font-bold shadow-[0_0_15px_rgba(0,229,255,0.15)]"
                              : "text-gray-300 hover:text-white hover:bg-white/[0.03]"
                          }`}
                        >
                          <span className="text-sm">#</span>
                          <span className="capitalize">{chan}</span>
                        </button>
                      ))}
                    </div>

                    {/* Chat Feed Window */}
                    <div className="lg:col-span-3 p-6 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between bg-[#0a0f1a]/30 min-h-[450px]">
                      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3 mb-4">
                        <span className="text-xs font-bold text-white uppercase tracking-wider"># {chatChannel} channel feed</span>
                      </div>

                      {/* Messages scroll box */}
                      <div className="flex-grow overflow-y-auto max-h-[350px] space-y-3.5 pr-2 scrollbar-none flex flex-col">
                        {chatMessages.length === 0 ? (
                          <div className="py-20 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2 flex-grow">
                            <span>No messages in #{chatChannel} yet.</span>
                            <span className="text-[10px] text-gray-600">Be the first to post a memory update! (+5 Points)</span>
                          </div>
                        ) : (
                          chatMessages.map((msg) => {
                            const isMe = msg.user_id === user?.id;
                            return (
                              <div
                                key={msg.id}
                                className={`flex flex-col max-w-[80%] ${
                                  isMe ? "self-end items-end" : "self-start items-start"
                                }`}
                              >
                                <span className="text-[9px] text-gray-400 mb-1 px-1 font-semibold">
                                  {isMe ? "You" : `@${msg.user?.username || "user"}`}
                                </span>
                                <div
                                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                                    isMe
                                      ? "bg-primary text-black font-semibold rounded-tr-none shadow-[0_0_15px_rgba(0,229,255,0.1)]"
                                      : "bg-white/[0.04] border border-white/[0.06] text-gray-100 rounded-tl-none"
                                  }`}
                                >
                                  {msg.content}
                                </div>
                                <span className="text-[8px] text-gray-600 mt-1 px-1">
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Chat Input Field */}
                      <form onSubmit={handleSendChatMessage} className="flex gap-2.5 mt-4 pt-4 border-t border-white/[0.06]">
                        <input
                          type="text"
                          required
                          value={newMessageContent}
                          onChange={(e) => setNewMessageContent(e.target.value)}
                          placeholder={`Message #${chatChannel}...`}
                          className="flex-grow px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all duration-300"
                        />
                        <button
                          type="submit"
                          disabled={isSendingChat}
                          className="px-5 py-3 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {isSendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* COMMUNITY CALENDAR TAB */}
                {activeTab === "calendar" && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary animate-pulse" />
                        <h3 className="text-sm font-bold text-white font-display">Ecosystem Workspace Calendar</h3>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] p-1 rounded-xl">
                        {["month", "week", "agenda"].map((view) => (
                          <button
                            key={view}
                            onClick={() => setCalendarView(view as any)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all capitalize ${
                              calendarView === view
                                ? "bg-primary text-black"
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            {view}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] bg-[#0a0f1a]/30 min-h-[400px]">
                      {calendarView === "agenda" ? (
                        <div className="space-y-4">
                          {events.map((ev) => (
                            <div key={ev.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-4">
                              <div>
                                <span className="text-[10px] text-primary font-mono">{ev.date}</span>
                                <h4 className="text-xs font-bold text-white mt-1">{ev.title}</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">{ev.location}</p>
                              </div>
                              <span className="text-[8px] font-extrabold px-2 py-0.5 rounded border border-primary/20 text-primary uppercase">Event</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-7 gap-2 text-center">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                            <span key={day} className="text-[9px] font-bold text-gray-500 uppercase tracking-wider py-2">{day}</span>
                          ))}
                          {Array.from({ length: 35 }).map((_, idx) => {
                            const dayNum = (idx % 31) + 1;
                            const hasEvent = events.some(e => new Date(e.date).getDate() === dayNum);
                            return (
                              <div
                                key={idx}
                                className={`p-4 rounded-xl border flex flex-col justify-between items-center min-h-[65px] transition-all ${
                                  hasEvent
                                    ? "bg-primary/5 border-primary/20 text-white"
                                    : "bg-white/[0.01] border-white/[0.04] text-gray-400 hover:bg-white/[0.02]"
                                }`}
                              >
                                <span className="text-[10px] font-bold">{dayNum}</span>
                                {hasEvent && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping mt-1"></span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* LEADERBOARDS TAB */}
                {activeTab === "leaderboard" && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      <h3 className="text-sm font-bold text-white font-display">Community Leaderboard Standings</h3>
                    </div>

                    {isLeaderboardLoading ? (
                      <div className="py-20 flex justify-center items-center">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    ) : (
                      <div className="rounded-2xl glass-panel border border-white/[0.06] overflow-hidden bg-[#0a0f1a]/20">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/[0.06] text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          <span className="col-span-2 text-center">Rank</span>
                          <span className="col-span-5">Participant</span>
                          <span className="col-span-3 text-center">Points Ledger</span>
                          <span className="col-span-2 text-center">Badges Earned</span>
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-white/5">
                          {commLeaderboard.map((entry, idx) => {
                            const is1st = idx === 0;
                            const is2nd = idx === 1;
                            const is3rd = idx === 2;
                            let rankStyle = "text-gray-400";
                            if (is1st) rankStyle = "text-yellow-400 font-extrabold shadow-[0_0_15px_rgba(234,179,8,0.2)] bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20";
                            if (is2nd) rankStyle = "text-gray-300 font-extrabold bg-white/5 px-2 py-0.5 rounded-full border border-white/10";
                            if (is3rd) rankStyle = "text-amber-600 font-extrabold bg-amber-700/10 px-2 py-0.5 rounded-full border border-amber-800/20";

                            return (
                              <div key={entry.user_id} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-white/[0.01] transition-colors">
                                <div className="col-span-2 text-center flex items-center justify-center">
                                  <span className={`text-[10px] tracking-wider uppercase ${rankStyle}`}>
                                    {idx + 1} {is1st ? "🏆" : is2nd ? "🥈" : is3rd ? "🥉" : ""}
                                  </span>
                                </div>
                                <div className="col-span-5 flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase">
                                    {entry.full_name.charAt(0)}
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-white block leading-tight">@{entry.username}</span>
                                    <span className="text-[9px] text-gray-400 mt-0.5 block">{entry.full_name}</span>
                                  </div>
                                </div>
                                <div className="col-span-3 text-center">
                                  <span className="text-xs font-bold text-primary font-mono">{entry.total_points} PTS</span>
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="text-[10px] font-bold text-gray-300">{entry.badge_count} badg.</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "gallery" && (
                  <div className="p-12 rounded-2xl glass-panel border border-white/[0.06] text-center flex flex-col items-center gap-4 py-20 flex-grow justify-center w-full">
                    <ImageIcon className="w-12 h-12 text-primary animate-pulse" />
                    <h3 className="text-base font-bold text-white font-display">Workspace Private Photo Assets Stream</h3>
                    <p className="text-xs text-gray-400 max-w-md leading-relaxed">
                       clearance authorized. You can inspect all contributor photo folders, preview AI crop tag locations, and download full raw galleries.
                    </p>
                  </div>
                )}

                {/* 5b. ✨ AI HIGHLIGHTS WORKSPACE TAB */}
                {activeTab === "highlights" && (
                  <div className="flex flex-col gap-6 flex-grow">
                    
                    {/* Header bar */}
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-white font-display">AI Curation Highlights Center</h3>
                        <span className="text-[9px] text-gray-400 px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.02] font-bold ml-1">
                          {highlightsAlbums.length} Highlight Albums
                        </span>
                      </div>
                      
                      {canManageEcosystem && (
                        <div className="flex items-center gap-2">
                          <select
                            value={highlightsLimit}
                            onChange={(e) => setHighlightsLimit(parseInt(e.target.value))}
                            className="bg-black/50 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                          >
                            <option value={10}>Top 10 Photos</option>
                            <option value={25}>Top 25 Photos</option>
                            <option value={50}>Top 50 Photos</option>
                          </select>
                          <button
                            onClick={() => handleGenerateCommunityHighlights(highlightsLimit)}
                            disabled={isGeneratingHighlights}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,229,255,0.15)] disabled:opacity-50"
                          >
                            {isGeneratingHighlights ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>Regenerate Highlights</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isHighlightsLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-4 flex-grow">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-xs text-gray-400 tracking-widest uppercase font-bold">Synchronizing curated folders...</span>
                      </div>
                    ) : !selectedHighlightsAlbum ? (
                      /* HIGHLIGHTS DASHBOARD OVERVIEW */
                      <div className="flex flex-col gap-6 flex-grow">
                        
                        {/* Albums grid */}
                        {highlightsAlbums.length === 0 ? (
                          <div className="p-16 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-4 py-24">
                            <Sparkles className="w-10 h-10 text-gray-400/20" />
                            <span className="text-sm font-bold text-gray-200">No highlights albums compiled yet</span>
                            <span className="text-xs text-gray-400 max-w-sm -mt-2">
                              {canManageEcosystem
                                ? "Trigger highlights compilation to curate the top photographic moments automatically."
                                : "The hosts haven't created any AI Highlights albums for this workspace yet."}
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {highlightsAlbums.map((album) => (
                              <motion.div
                                whileHover={{ y: -3 }}
                                key={album.id}
                                onClick={() => handleViewHighlightsAlbum(album)}
                                className="group relative p-5 rounded-2xl glass-panel border border-white/[0.06] hover:border-primary/30 cursor-pointer flex flex-col gap-3 transition-all duration-300"
                              >
                                <div className="w-full h-32 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/[0.06] flex items-center justify-center overflow-hidden relative">
                                  {album.cover_url ? (
                                    <img src={getOptimizedImageUrl(album.cover_url, 300)} alt={album.name} className="w-full h-full object-cover" loading="lazy" />
                                  ) : (
                                    <Sparkles className="w-8 h-8 text-gray-400/20" />
                                  )}
                                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 border border-white/[0.08] text-[8px] font-bold text-primary tracking-widest uppercase">
                                    AI Curated
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors font-display flex items-center gap-1.5">
                                    <span>{album.name}</span>
                                  </h4>
                                  {album.description && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 leading-relaxed">{album.description}</p>}
                                  <span className="text-[9px] text-gray-500 mt-1 block">
                                    Curated items: {album.media_count || 0} · Compiled: {new Date(album.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {/* Host controls for Event highlights (Module 10 & 16) */}
                        {canManageEcosystem && events.length > 0 && (
                          <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] bg-[#0a0f1a]/30 space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Event Curation Dashboard</h4>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-normal">
                              Compile outstanding highlights albums for specific community events. Curated photos will be aggregated and synced.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {events.map((ev) => (
                                <div key={ev.id} className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-4">
                                  <div>
                                    <h5 className="text-xs font-bold text-white leading-tight truncate max-w-[180px]">{ev.title}</h5>
                                    <span className="text-[9px] text-gray-400 font-mono mt-1 block">Date: {ev.date} · Status: {ev.status}</span>
                                  </div>
                                  <button
                                    onClick={() => handleGenerateEventHighlights(ev.id, highlightsLimit)}
                                    className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-black text-[9px] font-bold transition-all"
                                  >
                                    Curation Sweep
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Curation Run Execution logs list (Module 13 & 16) */}
                        {canManageEcosystem && highlightsLogs.length > 0 && (
                          <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] bg-[#0a0f1a]/30 space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                              <BarChart3 className="w-4 h-4 text-primary animate-pulse" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Curation Run Execution History</h4>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                              <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/[0.06] text-[8px] font-bold text-gray-400 uppercase tracking-widest bg-black/20">
                                <span className="col-span-3">Timestamp</span>
                                <span className="col-span-3 text-center">Photos Checked</span>
                                <span className="col-span-3 text-center">Duplicates Culled</span>
                                <span className="col-span-3 text-center">Operator</span>
                              </div>
                              <div className="divide-y divide-white/5 max-h-[160px] overflow-y-auto pr-1">
                                {highlightsLogs.map((log) => (
                                  <div key={log.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-[10px] hover:bg-white/[0.01]">
                                    <span className="col-span-3 text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                                    <span className="col-span-3 text-center font-bold text-emerald-400">{log.photos_analyzed} items</span>
                                    <span className="col-span-3 text-center font-bold text-red-400">{log.duplicates_removed} items</span>
                                    <span className="col-span-3 text-center text-gray-400">@{log.generated_by || "System"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    ) : (
                      /* CHOSEN HIGHLIGHTS ALBUM PHOTOS MASONRY VIEWER */
                      <div className="space-y-6 flex-grow flex flex-col">
                        <button
                          onClick={() => setSelectedHighlightsAlbum(null)}
                          className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors self-start"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Back to Highlights Grid</span>
                        </button>

                        <div className="p-6 rounded-2xl glass-panel border border-primary/20 bg-primary/[0.01] flex items-center justify-between flex-wrap gap-4 relative overflow-hidden">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/[0.01] blur-3xl -z-10"></div>
                          <div>
                            <h2 className="text-base font-extrabold text-white font-display leading-tight">{selectedHighlightsAlbum.name}</h2>
                            <p className="text-[10px] text-gray-400 mt-1 max-w-xl leading-relaxed">{selectedHighlightsAlbum.description}</p>
                            <span className="text-[9px] text-gray-500 mt-1 block uppercase tracking-widest font-semibold font-mono">
                              Curation Limit: {highlightsPhotos.length} Items
                            </span>
                          </div>
                          
                          {canManageEcosystem && (
                            <button
                              onClick={() => {
                                if (selectedHighlightsAlbum.event_id) {
                                  handleGenerateEventHighlights(selectedHighlightsAlbum.event_id, highlightsLimit);
                                } else {
                                  handleGenerateCommunityHighlights(highlightsLimit);
                                }
                              }}
                              disabled={isGeneratingHighlights}
                              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,229,255,0.15)] flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Regenerate Album</span>
                            </button>
                          )}
                        </div>

                        {highlightsPhotos.length === 0 ? (
                          <div className="p-16 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-4 py-24 flex-grow">
                            <Sparkles className="w-10 h-10 text-gray-400/20" />
                            <span className="text-sm font-bold text-gray-200">Highlights album is currently empty</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              columnCount: 3,
                              columnGap: "12px",
                            } as React.CSSProperties}
                            className="w-full"
                          >
                            {highlightsPhotos.map((media: any) => (
                              <motion.div
                                key={media.id}
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.01 }}
                                style={{ breakInside: "avoid", marginBottom: "12px" }}
                                className="group relative rounded-xl overflow-hidden border border-white/[0.06] hover:border-primary/40 cursor-pointer transition-all duration-300 shadow-lg"
                                onClick={() => setLightboxMedia(media)}
                              >
                                <img
                                  src={getOptimizedImageUrl(media.file_url, 300)}
                                  alt=""
                                  className="w-full h-auto block"
                                  loading="lazy"
                                />

                                {/* Premium AI Quality Badge */}
                                {media.overall_score > 0 && (
                                  <div className="absolute top-2.5 left-2.5 z-10 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/[0.08] text-[9px] font-bold text-white flex items-center gap-1 group/badge pointer-events-auto">
                                    <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                                    <span>{Math.round(media.overall_score)}% AI Score</span>
                                    <div className="absolute left-0 top-full mt-1.5 w-44 p-3 rounded-xl bg-[#0a0f1a]/95 backdrop-blur-xl border border-white/[0.1] shadow-2xl opacity-0 scale-95 group-hover/badge:opacity-100 group-hover/badge:scale-100 transition-all duration-200 origin-top-left pointer-events-none z-20 space-y-1.5 text-[9px]">
                                      <div className="font-extrabold text-primary border-b border-white/[0.08] pb-1 uppercase tracking-wider">Quality Breakdown</div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Sharpness:</span>
                                        <span className="font-bold text-white">{Math.round(media.sharpness_score)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Centering:</span>
                                        <span className="font-bold text-white">{Math.round(media.composition_score)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Lighting:</span>
                                        <span className="font-bold text-white">{Math.round(media.brightness_score)}%</span>
                                      </div>
                                      {media.face_visibility_score > 0 && (
                                        <>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Face Visibility:</span>
                                            <span className="font-bold text-white">{Math.round(media.face_visibility_score)}%</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Smile:</span>
                                            <span className="font-bold text-white">{Math.round(media.smile_score)}%</span>
                                          </div>
                                        </>
                                      )}
                                      {media.quality_reason && (
                                        <div className="pt-1.5 border-t border-white/[0.06] text-gray-400 italic font-medium leading-normal">
                                          "{media.quality_reason}"
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Admin manual cover selection override (Module 7) */}
                                {canManageEcosystem && (
                                  <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOverrideAlbumCover(selectedHighlightsAlbum.id, media.id);
                                      }}
                                      className={`p-1.5 rounded-lg backdrop-blur-md border transition-all ${
                                        selectedHighlightsAlbum.cover_media_id === media.id
                                          ? "bg-primary/20 border-primary/40 text-primary"
                                          : "bg-black/60 border-white/[0.08] text-gray-400 hover:text-white"
                                      }`}
                                      title={selectedHighlightsAlbum.cover_media_id === media.id ? "Album cover" : "Make album cover"}
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePinCommunityMedia(media);
                                      }}
                                      className={`p-1.5 rounded-lg backdrop-blur-md border transition-all ${
                                        media.is_pinned_highlight
                                          ? "bg-primary/20 border-primary/40 text-primary"
                                          : "bg-black/60 border-white/[0.08] text-gray-400 hover:text-white"
                                    }`}
                                      title={media.is_pinned_highlight ? "Pinned highlight" : "Pin highlight"}
                                    >
                                      <Plus className={`w-3.5 h-3.5 ${media.is_pinned_highlight ? "rotate-45" : ""}`} />
                                    </button>
                                  </div>
                                )}

                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
                                  {media.title && (
                                    <span className="text-xs font-bold text-white truncate">{media.title}</span>
                                  )}
                                  <span className="text-[9px] text-gray-300 mt-0.5">@{media.uploader?.username || "user"} · {getTimeAgo(media.created_at)}</span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. ACCESS REQUESTS QUEUE TAB */}
                {activeTab === "requests" && canManageEcosystem && (
                  <div className="flex flex-col gap-8 flex-grow">
                    {/* Community Role Requests Queue */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                        <Users className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold text-white font-display">Community Role Requests</h3>
                      </div>

                      {isRequestsLoading ? (
                        <div className="py-14 flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          <span className="text-xs text-gray-500 font-semibold">Loading requests...</span>
                        </div>
                      ) : joinRequests.length === 0 ? (
                        <div className="p-8 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-2 py-10 w-full">
                          <Users className="w-6 h-6 text-gray-400/20" />
                          <span className="text-xs text-gray-400">No pending join requests.</span>
                        </div>
                      ) : (
                        <div className="grid gap-4 w-full">
                          {joinRequests.map((request) => (
                            <div 
                              key={request.id}
                              className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex items-center justify-between gap-6 hover:border-primary/20 transition-all duration-300"
                            >
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-white">{request.user.full_name}</span>
                                  <span className="text-[10px] text-primary font-semibold">@{request.user.username}</span>
                                </div>
                                {request.message && (
                                  <p className="text-xs text-gray-300 mt-1 italic">"{request.message}"</p>
                                )}
                                <span className="text-[9px] text-gray-400 block mt-1.5">Submitted: {new Date(request.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleApprove(request.id)}
                                  className="px-4 py-2 rounded-xl bg-primary hover:bg-white text-black text-xs font-bold transition-all shadow-[0_0_10px_#06b6d4]"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReviewJoinRequest(request.id, "rejected")}
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

                    {/* Contributor Access Approvals Queue */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                        <UserCheck className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold text-white font-display">Contributor Access Approvals Queue</h3>
                      </div>

                      {requests.length === 0 ? (
                        <div className="p-8 rounded-2xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center justify-center gap-2 py-10 w-full">
                          <UserCheck className="w-6 h-6 text-gray-400/20" />
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
                  </div>
                )}

                {/* 4. MEMBERS DIRECTORY TAB */}
                {activeTab === "members" && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-white font-display">Collaborators & Permissions Control</h3>
                      </div>
                      {canManageEcosystem && (
                        <button
                          onClick={() => setIsOpenInviteModal(true)}
                          className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-primary text-black hover:bg-white text-xs font-bold transition-all shadow-lg"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Invite Collaborator</span>
                        </button>
                      )}
                    </div>

                    {isMembersLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        <span className="text-xs text-gray-500 font-semibold">Loading members...</span>
                      </div>
                    ) : (
                    <div className="p-6 rounded-2xl glass-panel border border-white/[0.06] flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                      {roles?.map((r) => {
                        const isSelf = r.user.email === user?.email;
                        let badgeStyle = "bg-white/[0.04] border-white/[0.08] text-gray-300"; // participant
                        if (r.role === "host") badgeStyle = "bg-amber-500/15 border-amber-500/30 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]";
                        if (r.role === "admin") badgeStyle = "bg-purple-500/15 border-purple-500/30 text-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.1)]";
                        if (r.role === "moderator") badgeStyle = "bg-blue-500/15 border-blue-500/30 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.1)]";

                        return (
                          <div key={r.id} className="flex items-center justify-between border-b border-white/[0.06] pb-4 last:border-0 last:pb-0 p-2 rounded-xl hover:bg-white/[0.01] transition-all group">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-xs font-bold text-white uppercase">{r.user.full_name.charAt(0)}</div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white leading-none">{r.user.full_name}</span>
                                  <span className="text-[10px] text-gray-400 leading-none">@{r.user.username}</span>
                                  {isSelf && <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold uppercase scale-90">Self</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400 font-semibold">
                                  <span className={`px-2 py-0.5 rounded-full border text-[8px] font-extrabold ${badgeStyle}`}>{r.role ? r.role.toUpperCase() : "PARTICIPANT"}</span>
                                  <span>Joined: {new Date(r.user.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap opacity-0 group-hover:opacity-100 transition-opacity">
                              
                              {/* Super Admin Direct Delete Icon */}
                              {((user?.platform_role?.toLowerCase() === "super_admin") && !isSelf) && (
                                <button
                                  onClick={() => handleRemoveMember(r.user.id)}
                                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.08] text-gray-400 hover:text-red-400 transition-all shadow-sm"
                                  title={`Remove ${r.role ? r.role.charAt(0).toUpperCase() + r.role.slice(1) : "Participant"}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}

                              {/* Host/Admin Tools (Only visible to non-Super Admins to avoid clutter, or shown if it's their own community) */}
                              {((isHost || isAdmin) && !isSelf && r.role !== "host" && !(user?.platform_role === "super_admin")) && (
                                <>
                                  {(r.role !== "admin" && (isHost || (isAdmin && r.role !== "admin"))) && (
                                    <button
                                      onClick={() => handlePromoteMember(r.user.id)}
                                      className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary border border-primary/20 text-primary hover:text-black text-[9px] font-bold transition-all"
                                    >
                                      Promote
                                    </button>
                                  )}
                                  {(isHost && r.role === "admin") && (
                                    <button
                                      onClick={() => handleDemoteAdmin(r.user.id)}
                                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 border border-amber-500/20 text-amber-400 hover:text-black text-[9px] font-bold transition-all"
                                    >
                                      Demote
                                    </button>
                                  )}
                                  {isHost && (
                                    <button
                                      onClick={() => handleTransferOwnership(r.user.id)}
                                      className="px-2.5 py-1.5 rounded-xl bg-secondary/10 hover:bg-secondary border border-secondary/20 text-secondary hover:text-white text-[9px] font-bold transition-all"
                                      title="Transfer Host Ownership to this participant"
                                    >
                                      Transfer Host
                                    </button>
                                  )}
                                  {(isHost || (isAdmin && r.role !== "admin")) && (
                                    <button
                                      onClick={() => handleRemoveMember(r.user.id)}
                                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-secondary/10 border border-white/[0.08] text-gray-400 hover:text-secondary transition-all"
                                      title="Evict Participant"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Super Admin: Role Management Menu */}
                              {(isSuperAdmin && !isSelf) && (
                                <div className="relative ml-2">
                                  <button
                                    onClick={() => setOpenMenuId(openMenuId === r.user.id ? null : r.user.id)}
                                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-gray-400 hover:text-white transition-all"
                                    title="Role Management"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  <AnimatePresence>
                                    {openMenuId === r.user.id && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[#0a0f1a] border border-white/[0.1] shadow-2xl z-50 overflow-hidden"
                                      >
                                        <div className="p-1 flex flex-col gap-1">
                                          {r.role === null && (
                                            <>
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: "moderator", actionType: "promote" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-blue-400 transition-colors text-left w-full"><ShieldCheck className="w-3.5 h-3.5" /> Promote to Moderator</button>
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: "admin", actionType: "promote" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-purple-400 transition-colors text-left w-full"><Shield className="w-3.5 h-3.5" /> Promote to Admin</button>
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: "host", actionType: "promote" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-amber-500 transition-colors text-left w-full"><Crown className="w-3.5 h-3.5" /> Promote to Host</button>
                                            </>
                                          )}
                                          {(r.role === "moderator" || r.role === "moderator") && (
                                            <>
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: "admin", actionType: "promote" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-purple-400 transition-colors text-left w-full"><Shield className="w-3.5 h-3.5" /> Promote to Admin</button>
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: "host", actionType: "promote" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-amber-500 transition-colors text-left w-full"><Crown className="w-3.5 h-3.5" /> Promote to Host</button>
                                              <div className="h-px bg-white/[0.08] my-1" />
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: null, actionType: "remove_access" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-gray-400 transition-colors text-left w-full"><UserMinus className="w-3.5 h-3.5" /> Remove Elevated Access</button>
                                              <div className="h-px bg-white/[0.08] my-1" />
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: null, actionType: "remove" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-xs text-red-400 transition-colors text-left w-full"><Trash2 className="w-3.5 h-3.5" /> Remove Access</button>
                                            </>
                                          )}
                                          {r.role === "admin" && (
                                            <>
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: "host", actionType: "promote" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-amber-500 transition-colors text-left w-full"><Crown className="w-3.5 h-3.5" /> Promote to Host</button>
                                              <div className="h-px bg-white/[0.08] my-1" />
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: null, actionType: "remove_access" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-gray-400 transition-colors text-left w-full"><UserMinus className="w-3.5 h-3.5" /> Remove Elevated Access</button>
                                              <div className="h-px bg-white/[0.08] my-1" />
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: null, actionType: "remove" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-xs text-red-400 transition-colors text-left w-full"><Trash2 className="w-3.5 h-3.5" /> Remove Access</button>
                                            </>
                                          )}
                                          {r.role === "host" && (
                                            <>
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, actionType: "transfer" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-white transition-colors text-left w-full"><Crown className="w-3.5 h-3.5" /> Transfer Host Role</button>
                                              <div className="h-px bg-white/[0.08] my-1" />
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: null, actionType: "remove_access" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-xs text-gray-400 transition-colors text-left w-full"><UserMinus className="w-3.5 h-3.5" /> Remove Elevated Access</button>
                                              <div className="h-px bg-white/[0.08] my-1" />
                                              <button onClick={() => { setSelectedMemberAction({ id: r.user.id, name: r.user.full_name, currentRole: r.role, newRole: null, actionType: "remove" }); setOpenMenuId(null); }} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-xs text-red-400 transition-colors text-left w-full"><Trash2 className="w-3.5 h-3.5" /> Remove Access</button>
                                            </>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}

                {/* 5. ANALYTICS TAB */}
                {activeTab === "analytics" && canManageEcosystem && (
                  <div className="flex flex-col gap-6 flex-grow">
                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                      <Activity className="w-4 h-4 text-primary animate-pulse" />
                      <h3 className="text-sm font-bold text-white font-display">Community Ecosystem Analytics</h3>
                    </div>

                    {isAnalyticsLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        <span className="text-xs text-gray-500 font-semibold">Refreshing analytics...</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Participants</span>
                        <span className="text-2xl font-extrabold text-white mt-2">{commAnalytics?.members_count || 0}</span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Events Active</span>
                        <span className="text-2xl font-extrabold text-primary mt-2">{commAnalytics?.events_count || 0}</span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Join Requests</span>
                        <span className="text-2xl font-extrabold text-amber-400 mt-2">{commAnalytics?.pending_requests_count || 0}</span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Announcements</span>
                        <span className="text-2xl font-extrabold text-white mt-2">{commAnalytics?.announcements_count || 0}</span>
                      </div>

                    </div>

                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 mt-4">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      <h3 className="text-sm font-bold text-white font-display">Biometric Engine Telemetry</h3>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Searches</span>
                        <span className="text-2xl font-extrabold text-white mt-2">
                          {recognitionStats?.total_searches?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Matches Found</span>
                        <span className="text-2xl font-extrabold text-primary mt-2">
                          {recognitionStats?.total_photos_found?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Failed Passes</span>
                        <span className="text-2xl font-extrabold text-red-400 mt-2">
                          {recognitionStats?.failed_searches?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] flex flex-col justify-between min-h-[100px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Storage Footprint</span>
                        <span className="text-2xl font-extrabold text-white mt-2">
                          {formatBytes(recognitionStats?.storage_used_bytes || 0)}
                        </span>
                      </div>
                    </div>
                    </>
                    )}
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

              </motion.div>
              </AnimatePresence>
            </div>
          )}

        </div>
      </main>


      {/* PUBLISH ANNOUNCEMENT MODAL */}
      <AnimatePresence>
        {isOpenAnnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenAnnModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-cyan-400"></div>
              
              <h2 className="text-lg font-bold text-white font-display mb-2 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary animate-bounce" />
                <span>Publish Announcement</span>
              </h2>
              <p className="text-xs text-gray-400 mb-6">Broadcast an important update or schedule change directly to all members.</p>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Announcement Title</label>
                  <input
                    type="text"
                    required
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g. Club Meeting Tomorrow"
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Content</label>
                  <textarea
                    required
                    rows={4}
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    placeholder="Provide detailed description, links, or directions..."
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all duration-300 resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setIsOpenAnnModal(false)}
                    className="flex-grow py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white font-semibold transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAnn}
                    className="flex-grow flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold bg-primary hover:bg-white text-black font-display transition-all duration-300"
                  >
                    {isSubmittingAnn ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                      <Sparkles className="w-4 h-4" />
                      <span>Broadcast</span>
                    </>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Event Category</label>
                        <select
                          value={eventCategory}
                          onChange={(e) => setEventCategory(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white transition-all duration-300"
                        >
                          <option value="Workshop" className="bg-gray-900">Workshop</option>
                          <option value="Seminar" className="bg-gray-900">Seminar</option>
                          <option value="Photography Walk" className="bg-gray-900">Photography Walk</option>
                          <option value="Hackathon" className="bg-gray-900">Hackathon</option>
                          <option value="Competition" className="bg-gray-900">Competition</option>
                          <option value="Meetup" className="bg-gray-900">Meetup</option>
                          <option value="Guest Lecture" className="bg-gray-900">Guest Lecture</option>
                          <option value="Exhibition" className="bg-gray-900">Exhibition</option>
                          <option value="Club Activity" className="bg-gray-900">Club Activity</option>
                          <option value="Other" className="bg-gray-900">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Max Capacity</label>
                        <input
                          type="number"
                          value={eventMaxParticipants}
                          onChange={(e) => setEventMaxParticipants(e.target.value)}
                          placeholder="e.g. 100"
                          min="1"
                          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.06] focus:border-primary/50 focus:outline-none text-xs text-white placeholder-gray-600 transition-all duration-300"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Reg. Deadline</label>
                        <input
                          type="datetime-local"
                          value={eventRegistrationDeadline}
                          onChange={(e) => setEventRegistrationDeadline(e.target.value)}
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

      {/* INVITE MEMBERS SEARCH / CODE MODAL */}
      <AnimatePresence>
        {isOpenInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsOpenInviteModal(false); setInviteSuccessMsg(""); setSelectedQRInvite(null); }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-cyan-400"></div>
              
              <h2 className="text-lg font-bold text-white font-display mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Invite to Community</span>
              </h2>

              {/* Tabs */}
              <div className="flex border-b border-white/[0.06] mb-5">
                <button
                  onClick={() => setInviteTab("search")}
                  className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition-all ${
                    inviteTab === "search" ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  Direct Username Invite
                </button>
                <button
                  onClick={() => setInviteTab("code")}
                  className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition-all ${
                    inviteTab === "code" ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  Invite Link & QR Code
                </button>
              </div>

              {inviteTab === "search" ? (
                <>
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
                          <p className="text-[9px] text-gray-400 mt-1 max-w-[240px]">We couldn't find any users matching your query. Double check the spelling.</p>
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
                                <span className="text-[8px] font-bold px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">Already Member</span>
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
                </>
              ) : (
                <div className="space-y-6">
                  {/* Generate Code Form */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                    <span className="text-xs font-bold text-gray-300 block mb-2">Create New Invite Link / QR</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Join Mode</label>
                        <select
                          value={inviteJoinMode}
                          onChange={(e: any) => setInviteJoinMode(e.target.value)}
                          className="w-full bg-[#0a0f1a] border border-white/[0.08] text-xs text-white rounded-lg p-2.5"
                        >
                          <option value="auto">Auto Join</option>
                          <option value="approval">Request Approval</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Expiration</label>
                        <select
                          value={inviteExpires}
                          onChange={(e) => setInviteExpires(Number(e.target.value))}
                          className="w-full bg-[#0a0f1a] border border-white/[0.08] text-xs text-white rounded-lg p-2.5"
                        >
                          <option value={0}>Never</option>
                          <option value={1}>1 Day</option>
                          <option value={7}>7 Days</option>
                          <option value={30}>30 Days</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Usage Limit</label>
                      <select
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                        className="w-full bg-[#0a0f1a] border border-white/[0.08] text-xs text-white rounded-lg p-2.5"
                      >
                        <option value={0}>Unlimited</option>
                        <option value={1}>Single Use</option>
                        <option value={10}>10 Uses</option>
                        <option value={100}>100 Uses</option>
                      </select>
                    </div>

                    <button
                      onClick={handleGenerateInviteCode}
                      disabled={isGeneratingInviteCode}
                      type="button"
                      className="w-full py-2.5 rounded-lg bg-primary hover:bg-cyan-400 text-black text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      {isGeneratingInviteCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate Invite Link & QR"}
                    </button>
                  </div>

                  {/* Active Codes List */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-300 block">Active Invite Codes</span>
                    {inviteCodesList.length === 0 ? (
                      <span className="text-xs text-gray-500 italic block py-4 text-center">No active invite codes generated yet.</span>
                    ) : (
                      <div className="space-y-2.5 max-h-[200px] overflow-y-auto">
                        {inviteCodesList.map((code) => (
                          <div key={code.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3 text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-primary tracking-wider">{code.code}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  code.join_mode === "auto" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                }`}>
                                  {code.join_mode}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                <span>Uses: {code.uses_count}/{code.max_uses || "∞"}</span>
                                <span>•</span>
                                <span>Expires: {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : "Never"}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  const url = `${window.location.origin}/dashboard/communities/${communityId}?code=${code.code}`;
                                  navigator.clipboard.writeText(url);
                                  alert("Invite Link copied to clipboard!");
                                }}
                                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                                title="Copy Link"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => setSelectedQRInvite(code)}
                                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                                title="Show QR Code"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteInviteCode(code.id)}
                                className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                                title="Delete Code"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* QR Code Popup overlay */}
              {selectedQRInvite && (
                <div className="absolute inset-0 bg-[#0a0f1a] z-20 p-8 flex flex-col items-center justify-center text-center">
                  <div className="relative p-6 bg-white rounded-xl mb-4 border border-white/[0.08] shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                    {/* Retro styling simulated QR */}
                    <div className="w-40 h-40 border-4 border-black flex flex-col items-center justify-center p-2 relative bg-white">
                      {/* Fake QR blocks */}
                      <div className="absolute top-2 left-2 w-10 h-10 border-4 border-black bg-white" />
                      <div className="absolute top-2 right-2 w-10 h-10 border-4 border-black bg-white" />
                      <div className="absolute bottom-2 left-2 w-10 h-10 border-4 border-black bg-white" />
                      {/* Fake random QR pixel clusters */}
                      <div className="w-full h-full flex flex-wrap gap-1 p-2 opacity-85 select-none">
                        {Array.from({ length: 48 }).map((_, idx) => (
                          <div
                            key={idx}
                            className={`w-3.5 h-3.5 rounded-sm ${
                              (idx * 7 + 13) % 5 === 0 || idx % 7 === 0 ? "bg-black" : "bg-white"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Scan Venue Entry QR</h3>
                  <span className="text-xs text-primary font-mono tracking-widest uppercase mb-4">{selectedQRInvite.code}</span>
                  <p className="text-[10px] text-gray-400 max-w-[280px] mb-6">
                    Hosts can place this QR code at physical venues. Attendees scan to immediately join this private space.
                  </p>
                  
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/dashboard/communities/${communityId}?code=${selectedQRInvite.code}`;
                        navigator.clipboard.writeText(url);
                        alert("Link copied!");
                      }}
                      className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-cyan-400 text-black font-semibold text-xs transition-colors"
                    >
                      Copy Invite Link
                    </button>
                    <button
                      onClick={() => setSelectedQRInvite(null)}
                      className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold transition-colors"
                    >
                      Close QR
                    </button>
                  </div>
                </div>
              )}

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
        {selectedRecognition && (() => {
          const rec = selectedRecognition;
          return (
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
                        {rec.user.full_name?.[0] || "?"}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          {rec.user.username.startsWith("@") ? rec.user.username : `@${rec.user.username}`}
                        </h3>
                        <p className="text-[10px] text-gray-400">{rec.user.full_name} • {rec.user.email}</p>
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
                      <span className="text-lg font-extrabold text-emerald-400 mt-1 block">{rec.matched_photos_count}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Avg Confidence</span>
                      <span className="text-lg font-extrabold text-primary mt-1 block">{(rec.average_confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Processing</span>
                      <span className="text-lg font-extrabold text-white mt-1 block">{rec.processing_time_ms}ms</span>
                    </div>
                  </div>

                  {/* Event Info */}
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Event Searched</span>
                    <p className="text-sm font-semibold text-white">{rec.event?.title || "Unknown Event"}</p>
                    {rec.event?.location && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {rec.event.location}</p>
                    )}
                  </div>

                  {/* Status & Liveness */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Verification Status</span>
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${
                        rec.status === "verified"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-secondary/10 border-secondary/20 text-secondary"
                      }`}>
                        {rec.status === "verified" && rec.matched_photos_count === 0
                          ? "NO MATCH"
                          : rec.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Liveness Score</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-grow h-2 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              rec.liveness_score >= 0.8 ? "bg-emerald-400" :
                              rec.liveness_score >= 0.5 ? "bg-amber-400" : "bg-secondary"
                            }`}
                            style={{ width: `${rec.liveness_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-white">{(rec.liveness_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Timestamp</span>
                    <p className="text-xs text-white font-medium">{new Date(rec.created_at).toLocaleString()}</p>
                  </div>

                  {/* Device & Network */}
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-3">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Device & Network</span>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">IP Address</span>
                        <span className="text-[10px] font-mono text-white">{rec.ip_address || "N/A"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-[10px] text-gray-400 shrink-0">Device Info</span>
                        <span className="text-[10px] text-white text-right break-all leading-relaxed">{
                          rec.device_info
                            ? rec.device_info.length > 80
                              ? rec.device_info.substring(0, 80) + "..."
                              : rec.device_info
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
          );
        })()}
      </AnimatePresence>

      {/* ====== REQUEST EVENT ACCESS MODAL ====== */}
      <AnimatePresence>
        {showEventAccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEventAccessModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="request-event-access-title"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setShowEventAccessModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
                <h2 id="request-event-access-title" className="text-lg font-display font-semibold text-gray-50">Request Event Access</h2>
              </div>
              <p className="text-sm text-gray-400 mb-6 mt-2">Submit a request to become an event organizer for this community.</p>

              {eventAccessError && (
                <div className="mb-4 p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-secondary font-medium flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {eventAccessError}
                </div>
              )}

              {eventAccessSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-2">Request Submitted</h3>
                  <p className="text-gray-400">The Community Host will review your request shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleRequestEventAccess} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="eventAccessReason" className="text-sm font-medium text-gray-200">Why do you need event creation access?</label>
                    <textarea
                      id="eventAccessReason"
                      required
                      rows={4}
                      value={eventAccessReason}
                      onChange={(e) => setEventAccessReason(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                      placeholder="e.g. I am organizing the annual hackathon..."
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEventAccessModal(false)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAccess}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                      {isSubmittingAccess ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE EVENT CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteEventId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteEventId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-red-500 rounded-t-2xl" aria-hidden="true" />
              <h2 className="text-lg font-display font-semibold text-gray-50 mb-1">Delete Event</h2>
              <p className="text-sm text-gray-400 mb-6 font-display mt-2">
                Are you sure you want to delete this event? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteEventId(null)}
                  className="px-4 py-2 rounded-lg bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteEvent}
                  disabled={isDeletingEvent}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all flex items-center gap-2"
                >
                  {isDeletingEvent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUPER ADMIN ROLE MANAGEMENT MODAL */}
      <AnimatePresence>
        {selectedMemberAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedMemberAction(null); setTransferTargetId(""); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-sm bg-[#0a0f1a] border border-white/[0.1] rounded-2xl p-6 shadow-2xl relative z-10"
            >
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                {selectedMemberAction.actionType === "promote" && <ShieldCheck className="w-5 h-5 text-primary" />}
                {selectedMemberAction.actionType === "remove_access" && <UserMinus className="w-5 h-5 text-gray-400" />}
                {selectedMemberAction.actionType === "remove" && <Trash2 className="w-5 h-5 text-red-500" />}
                {selectedMemberAction.actionType === "transfer" && <Crown className="w-5 h-5 text-amber-500" />}
                
                {selectedMemberAction.actionType === "promote" && "Promote User"}
                {selectedMemberAction.actionType === "remove_access" && "Remove Elevated Access"}
                {selectedMemberAction.actionType === "remove" && "Remove Elevated Role"}
                {selectedMemberAction.actionType === "transfer" && "Transfer Host Ownership"}
              </h3>
              
              <div className="text-xs text-gray-400 mb-6 leading-relaxed">
                {selectedMemberAction.actionType === "promote" && (
                  <p>Are you sure you want to promote <strong className="text-white">{selectedMemberAction.name}</strong> to <strong className="text-white capitalize">{selectedMemberAction.newRole}</strong>?</p>
                )}
                {selectedMemberAction.actionType === "remove_access" && (
                  <p>Are you sure you want to remove_access <strong className="text-white">{selectedMemberAction.name}</strong> to <strong className="text-white capitalize">{selectedMemberAction.newRole}</strong>?</p>
                )}
                {selectedMemberAction.actionType === "remove" && (
                  <p><strong className="text-white">{selectedMemberAction.name}</strong> will remain a community participant. Only the elevated role will be removed.</p>
                )}
                {selectedMemberAction.actionType === "transfer" && (
                  <>
                    <p className="mb-3">Select a new Host before continuing.</p>
                    <select
                      value={transferTargetId}
                      onChange={(e) => setTransferTargetId(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-100 focus:outline-none focus:border-primary/50 transition-all appearance-none"
                    >
                      <option value="">-- Select New Host --</option>
                      {roles?.filter(r => r.user.id !== selectedMemberAction.id).map(r => (
                        <option key={r.user.id} value={r.user.id}>{r.user.full_name} ({r.role ?? "Participant"})</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setSelectedMemberAction(null); setTransferTargetId(""); }}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={selectedMemberAction.actionType === "transfer" ? handleSuperAdminTransferHost : handleSuperAdminRoleUpdate}
                  disabled={isUpdatingRole || (selectedMemberAction.actionType === "transfer" && !transferTargetId)}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 ${
                    selectedMemberAction.actionType === "remove" ? "bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(255,45,45,0.3)]" : 
                    selectedMemberAction.actionType === "transfer" ? "bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]" :
                    "bg-primary text-black hover:bg-white shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  }`}
                >
                  {isUpdatingRole ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Processing...
                    </>
                  ) : "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
