"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Calendar, MapPin, Loader2,
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, X,
  FileText, Upload, Radio, Archive
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

  const defaultEventCovers: Record<string, string> = {
    Technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop",
    Education: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=600&auto=format&fit=crop",
    Photography: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=600&auto=format&fit=crop",
    Music: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
    Sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
  };

  const fetchData = async () => {
    try {
      const commRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}`);
      if (!commRes.ok) throw new Error("Community not found.");
      const commData = await commRes.json();
      setCommunity(commData);

      const rolesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/roles`);
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }

      const eventsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/community/${communityId}`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
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

  const submitAccessRequest = async (requestType: "contributor" | "upload" | "gallery" | "member") => {
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
                  <button
                    onClick={() => submitAccessRequest("contributor")}
                    type="button"
                    className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-[#030712] hover:bg-cyan-400 transition-colors"
                  >
                    Request Access
                  </button>
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
                              onClick={() => submitAccessRequest("upload")}
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
