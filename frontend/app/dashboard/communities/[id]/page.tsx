"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Calendar, MapPin, Loader2,
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, X,
  FileText, Upload, Radio, Archive, Key, AlertCircle
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
}

interface ContributorRole {
  id: string;
  role: string;
  user: {
    id: string;
    full_name: string;
    username: string;
    email: string;
  };
}

const statusConfig: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  draft: { icon: FileText, color: "text-gray-400 bg-gray-500/10 border-gray-500/20", label: "Draft" },
  uploading: { icon: Upload, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Uploading" },
  processing: { icon: Loader2, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", label: "Processing" },
  live: { icon: Radio, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Live" },
  archived: { icon: Archive, color: "text-gray-500 bg-gray-600/10 border-gray-600/20", label: "Archived" },
};

export default function PublicCommunityDetails() {
  const params = useParams();
  const router = useRouter();
  const { token, user, isAuthenticated } = useAuthStore();
  const communityId = params.id as string;

  const [community, setCommunity] = useState<Community | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [roles, setRoles] = useState<ContributorRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [requestSentAlert, setRequestSentAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [joinRequestStatus, setJoinRequestStatus] = useState<string | null>(null);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  const [isForbidden, setIsForbidden] = useState(false);
  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isJoiningCode, setIsJoiningCode] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState("");
  const [joinCodeSuccess, setJoinCodeSuccess] = useState("");

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setIsJoiningCode(true);
    setJoinCodeError("");
    setJoinCodeSuccess("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/join-by-code/${joinCodeInput.trim()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid invite code.");
      }

      if (data.joined) {
        setJoinCodeSuccess(data.message || "Successfully joined community!");
        setTimeout(() => {
          setShowJoinCodeModal(false);
          setJoinCodeInput("");
          setJoinCodeSuccess("");
          setIsForbidden(false);
          fetchData();
          router.push(`/dashboard/my-groups/${communityId}`);
        }, 1500);
      } else {
        setJoinCodeSuccess(data.message || "Join request submitted.");
        setJoinRequestStatus("pending");
        setTimeout(() => {
          setShowJoinCodeModal(false);
          setJoinCodeInput("");
          setJoinCodeSuccess("");
        }, 3000);
      }
    } catch (err: any) {
      setJoinCodeError(err.message || "Failed to join community.");
    } finally {
      setIsJoiningCode(false);
    }
  };


  const defaultEventCovers: Record<string, string> = {
    Technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop",
    Education: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=600&auto=format&fit=crop",
    Photography: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=600&auto=format&fit=crop",
    Music: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
    Sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
  };

  const fetchData = async () => {
    try {
      const commRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (commRes.status === 403) {
        setIsForbidden(true);
        setIsLoading(false);
        return;
      }
      if (!commRes.ok) throw new Error("Community not found.");
      const commData = await commRes.json();
      setCommunity(commData);

      const rolesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }

      const eventsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/community/${communityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }

      const myRolesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (myRolesRes.ok) {
        const rolesMap = await myRolesRes.json();
        setCurrentUserRole(rolesMap[communityId] || null);
      }

      const myJoinReqsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-join-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (myJoinReqsRes.ok) {
        const reqsMap = await myJoinReqsRes.json();
        setJoinRequestStatus(reqsMap[communityId] || null);
      }
    } catch (err) {
      console.error("Error loading community discovery details:", err);
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

  const submitAccessRequest = async (requestType: "moderator" | "admin" | "host") => {
    setShowMoreMenu(false);
    setRequestSentAlert(false);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ request_type: requestType }),
      });
      const data = await response.json();
      if (response.ok) {
        setAlertMessage(`Your '${requestType}' request has been sent to the host.`);
        setRequestSentAlert(true);
        setTimeout(() => setRequestSentAlert(false), 4000);
      } else {
        setAlertMessage(data.detail || "Unable to submit request.");
        setRequestSentAlert(true);
        setTimeout(() => setRequestSentAlert(false), 4000);
      }
    } catch (err) {
      console.error("Access request failed:", err);
    }
  };

  const submitJoinRequest = async () => {
    setIsSubmittingJoin(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/join-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: "I want to join this community as a participant" }),
      });
      const data = await response.json();
      if (response.ok) {
        setJoinRequestStatus("pending");
        setAlertMessage("Your request to join this community has been submitted.");
        setRequestSentAlert(true);
        setTimeout(() => setRequestSentAlert(false), 4000);
      } else {
        setAlertMessage(data.detail || "Unable to submit request.");
        setRequestSentAlert(true);
        setTimeout(() => setRequestSentAlert(false), 4000);
      }
    } catch (err) {
      console.error("Join request failed:", err);
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const handleContactHost = () => {
    setShowMoreMenu(false);
    const hostMember = roles.find((r) => r.role === "host");
    if (hostMember) {
      setAlertMessage(`Host: ${hostMember.user.full_name} (@${hostMember.user.username}) — ${hostMember.user.email}`);
      setRequestSentAlert(true);
      setTimeout(() => setRequestSentAlert(false), 6000);
    }
  };

  const filteredEvents =
    events?.filter(
      (e) =>
        e?.title?.toLowerCase().includes(searchQuery?.toLowerCase() || "") ||
        e?.location?.toLowerCase().includes(searchQuery?.toLowerCase() || "")
    ) || [];

  if (!isAuthenticated) return null;

  if (isForbidden) {
    return (
      <div className="flex flex-col min-h-screen bg-[#030712] text-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl glass-panel border border-white/[0.06] bg-[#050b18]/60 p-8 text-center flex flex-col items-center shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500/80 to-amber-500/80" />
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20 text-red-500 animate-pulse">
              <span className="text-3xl">🔒</span>
            </div>
            
            <h1 className="text-2xl font-display font-bold text-gray-50 mb-3">Private Community</h1>
            <p className="text-sm text-gray-400 mb-8 max-w-sm leading-relaxed">
              This community is invisible and restricted to approved participants only. You must scan a QR code or submit an access request to enter.
            </p>

            {joinRequestStatus === "pending" ? (
              <div className="w-full p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 font-semibold text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>⏳ Access Request Pending...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-4 w-full">
                <button
                  onClick={submitJoinRequest}
                  disabled={isSubmittingJoin}
                  type="button"
                  className="w-full py-3 rounded-xl bg-primary text-black hover:bg-cyan-400 text-sm font-semibold transition-all shadow-lg shadow-primary/10 flex items-center justify-center gap-2"
                >
                  {isSubmittingJoin ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Request Access</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setShowJoinCodeModal(true)}
                  type="button"
                  className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-300 text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4 text-gray-400" />
                  <span>Enter Invite Code</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Invite Code Input Dialog */}
        <AnimatePresence>
          {showJoinCodeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowJoinCodeModal(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-2xl glass-panel border border-white/[0.08] p-8 relative z-10"
              >
                <button
                  type="button"
                  onClick={() => setShowJoinCodeModal(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="text-base font-semibold text-white mb-2">Enter Invite Code</h3>
                <p className="text-xs text-gray-400 mb-6">Type a community invite code to join immediately.</p>
                
                {joinCodeError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {joinCodeError}
                  </div>
                )}
                
                {joinCodeSuccess && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                    {joinCodeSuccess}
                  </div>
                )}

                <form onSubmit={handleJoinByCode} className="space-y-4">
                  <input
                    type="text"
                    required
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    placeholder="e.g. WELCOME2026"
                    className="w-full h-12 px-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-primary focus:outline-none text-base text-gray-50 placeholder-gray-600 text-center font-mono font-bold uppercase tracking-wider"
                  />
                  <button
                    type="submit"
                    disabled={isJoiningCode || !joinCodeInput.trim()}
                    className="w-full py-3 rounded-lg bg-primary hover:bg-cyan-400 text-black font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {isJoiningCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Join"}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow flex flex-col">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6" aria-label="Breadcrumb">
          <button
            onClick={() => router.push("/dashboard")}
            className="hover:text-gray-50 transition-colors"
            type="button"
          >
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          <span className="text-gray-50 font-medium truncate">{community?.title || "Community"}</span>
        </nav>

        {/* Success alert */}
        {requestSentAlert && (
          <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary font-medium flex items-center gap-2" role="alert" aria-live="polite">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{alertMessage}</span>
          </div>
        )}

        {isLoading || !community ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 flex-grow">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-sm text-gray-400">
              Loading community...
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-8 flex-grow">
            {/* COMMUNITY BANNER */}
            <div className="relative rounded-2xl glass-panel border border-white/[0.06] overflow-hidden">
              {/* Background image */}
              <div className="h-64 relative">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${community.banner_url || defaultEventCovers[community.category]})`,
                    opacity: 0.2,
                  }}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/80 to-transparent" />

                {/* Content overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <span className="text-xs font-medium text-primary px-3 py-1 rounded-full bg-primary/[0.08] border border-primary/20">
                    {community.category}
                  </span>
                  <h1 className="text-3xl font-display font-bold text-gray-50 mt-3">
                    {community.title}
                  </h1>
                  <p className="mt-2 text-sm text-gray-400 max-w-2xl leading-relaxed">
                    {community.description}
                  </p>
                </div>
              </div>

              {/* Actions toolbar */}
              <div className="px-8 py-4 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-medium text-gray-300">{roles.length} Collaborators</span>
                </div>

                <div className="flex items-center gap-2">
                  {currentUserRole ? (
                    <button
                      type="button"
                      disabled
                      className="h-10 px-4 rounded-lg text-sm font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 cursor-not-allowed"
                    >
                      Joined
                    </button>
                  ) : joinRequestStatus === "pending" ? (
                    <button
                      type="button"
                      disabled
                      className="h-10 px-4 rounded-lg text-sm font-semibold bg-amber-500/10 border border-amber-500/25 text-amber-400 cursor-not-allowed"
                    >
                      Request Sent
                    </button>
                  ) : (
                    <button
                      onClick={submitJoinRequest}
                      type="button"
                      disabled={isSubmittingJoin}
                      className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-[#030712] hover:bg-cyan-400 transition-colors disabled:opacity-50"
                    >
                      {isSubmittingJoin ? "Joining..." : "Join Community"}
                    </button>
                  )}
                  <button
                    onClick={handleContactHost}
                    type="button"
                    className="h-10 px-4 rounded-lg text-sm font-medium bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                  >
                    Contact Host
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="h-10 px-3.5 rounded-lg text-sm font-medium bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] border border-white/[0.08] transition-colors flex items-center gap-1"
                      aria-expanded={showMoreMenu}
                      aria-haspopup="true"
                    >
                      <span>More</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    </button>

                    <AnimatePresence>
                      {showMoreMenu && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 6 }}
                            className="absolute right-0 mt-2 w-52 rounded-xl glass-panel border border-white/[0.08] p-1 shadow-2xl z-20"
                            role="menu"
                          >
                            <button
                              type="button"
                              onClick={() => submitAccessRequest("moderator")}
                              className="w-full px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/[0.04] rounded-lg transition-colors"
                              role="menuitem"
                            >
                              Request Upload Access
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowMoreMenu(false);
                                navigator.clipboard.writeText(window.location.href);
                                setAlertMessage("Community link copied to clipboard!");
                                setRequestSentAlert(true);
                                setTimeout(() => setRequestSentAlert(false), 3000);
                              }}
                              className="w-full px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/[0.04] rounded-lg transition-colors"
                              role="menuitem"
                            >
                              Copy Community Link
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowMoreMenu(false);
                                setAlertMessage("Community reported to moderation.");
                                setRequestSentAlert(true);
                                setTimeout(() => setRequestSentAlert(false), 3000);
                              }}
                              className="w-full px-3 py-2.5 text-left text-sm text-secondary hover:bg-secondary/[0.06] rounded-lg transition-colors"
                              role="menuitem"
                            >
                              Report Community
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            {/* EVENTS SECTION */}
            <div className="space-y-6 flex-grow flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg font-display font-semibold text-gray-50 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Events
                </h2>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events..."
                  aria-label="Search events by name or location"
                  className="h-10 px-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-sm text-gray-50 placeholder-gray-600 w-full max-w-sm transition-colors"
                />
              </div>

              {filteredEvents.length === 0 ? (
                <div className="p-16 rounded-xl glass-panel border border-dashed border-white/[0.06] text-center flex flex-col items-center gap-4 flex-grow justify-center">
                  <Calendar className="w-12 h-12 text-gray-700" />
                  <h3 className="text-lg font-medium text-gray-300">No events yet</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    This community has not published any events. Check back later for upcoming memories!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredEvents.map((event) => {
                    if (!event) return null;
                    const status = statusConfig[event.status] || statusConfig.draft;
                    const StatusIcon = status.icon;
                    return (
                      <motion.div
                        whileHover={{ y: -3 }}
                        key={event.id}
                        onClick={() => router.push(`/dashboard/events/${event.id}`)}
                        className="rounded-xl glass-panel border border-white/[0.06] card-hover cursor-pointer flex flex-col justify-between transition-all duration-300 group overflow-hidden"
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-center mb-3">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${status.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-gray-50 group-hover:text-primary transition-colors">
                            {event.title}
                          </h3>
                          <p className="mt-2 text-sm text-gray-400 line-clamp-2 leading-relaxed">
                            {event.description}
                          </p>
                        </div>

                        <div className="px-6 pb-5 pt-4 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                            <span>{event.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-600" />
                            <span>{event.date}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
