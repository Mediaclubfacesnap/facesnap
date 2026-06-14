"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Sparkles, User, Calendar, MapPin, Loader2, ArrowRight,
  MessageSquare, Compass, Activity, Camera, Home, LogOut, ExternalLink,
  ThumbsUp, Trash, Star, Bookmark, BookmarkCheck, Users, HelpCircle,
  Clock, AlertCircle, Volume2, BookmarkPlus
} from "lucide-react";

interface UserInfo {
  id: string;
  username: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  platform_role: string;
  is_online: boolean;
  last_seen: string | null;
}

interface Community {
  id: string;
  title: string;
  description: string;
  category: string;
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
}

interface PhotoMatch {
  match_id: string;
  media_id: string | null;
  photo_id: string | null;
  file_url: string;
  confidence: number;
  status: string;
  is_favorite: boolean;
  title: string | null;
  description: string | null;
  created_at: string;
  community_title: string;
  album_name: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  shared_item_id: string | null;
  created_at: string;
  sender?: UserInfo;
}

interface HighlightAlbum {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_highlights: boolean;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  community?: Community;
}

interface SavedSearch {
  id: string;
  query: string;
  created_at: string;
}

interface HistoryItem {
  id: string;
  query: string;
  created_at: string;
}

const getOptimizedImageUrl = (url: string, width: number = 250) => {
  if (!url) return "";
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${width}&resize=contain`;
  }
  return url;
};

export default function SearchWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "all" | "users" | "communities" | "events" | "photos" | "messages" | "highlights" | "announcements"
  >("all");

  // Results state
  const [usersList, setUsersList] = useState<UserInfo[]>([]);
  const [communitiesList, setCommunitiesList] = useState<Community[]>([]);
  const [eventsList, setEventsList] = useState<Event[]>([]);
  const [photosList, setPhotoMatchList] = useState<PhotoMatch[]>([]);
  const [messagesList, setMessagesList] = useState<Message[]>([]);
  const [highlightsList, setHighlightsList] = useState<HighlightAlbum[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<Announcement[]>([]);

  // Metadata states
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sub-search pagination states
  const [usersOffset, setUsersOffset] = useState(20);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [communitiesOffset, setCommunitiesOffset] = useState(20);
  const [hasMoreCommunities, setHasMoreCommunities] = useState(true);
  const [eventsOffset, setEventsOffset] = useState(20);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");

  // Search input ref
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSignOut = () => {
    logout();
    router.push("/");
  };

  // Fetch Metadata: History, Saved searches, Trending terms
  const fetchMetadata = useCallback(async () => {
    try {
      const [histRes, savedRes, trendRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/history`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/saved`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/trending`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (histRes.ok) setHistory(await histRes.json());
      if (savedRes.ok) setSavedSearches(await savedRes.json());
      if (trendRes.ok) setTrending(await trendRes.json());
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  // Execute Search
  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setShowSuggestions(false);
    
    // Reset pagination offsets
    setUsersOffset(20);
    setHasMoreUsers(true);
    setCommunitiesOffset(20);
    setHasMoreCommunities(true);
    setEventsOffset(20);
    setHasMoreEvents(true);
    
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSubmittedQuery(searchQuery);
        setUsersList(data.users);
        setCommunitiesList(data.communities);
        setEventsList(data.events);
        setPhotoMatchList(data.photos);
        setMessagesList(data.messages);
        setHighlightsList(data.highlights);
        setAnnouncementsList(data.announcements);
        
        // Refresh history
        fetchMetadata();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchMetadata]);

  // Scoped sub-searches paginations
  const fetchMoreUsers = async () => {
    if (isFetchingMore || !hasMoreUsers || !query.trim()) return;
    setIsFetchingMore(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/users?q=${encodeURIComponent(query)}&limit=20&offset=${usersOffset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.length < 20) setHasMoreUsers(false);
        setUsersList((prev) => [...prev, ...data]);
        setUsersOffset((prev) => prev + 20);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const fetchMoreCommunities = async () => {
    if (isFetchingMore || !hasMoreCommunities || !query.trim()) return;
    setIsFetchingMore(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/communities?q=${encodeURIComponent(query)}&limit=20&offset=${communitiesOffset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.length < 20) setHasMoreCommunities(false);
        setCommunitiesList((prev) => [...prev, ...data]);
        setCommunitiesOffset((prev) => prev + 20);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const fetchMoreEvents = async () => {
    if (isFetchingMore || !hasMoreEvents || !query.trim()) return;
    setIsFetchingMore(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/events?q=${encodeURIComponent(query)}&limit=20&offset=${eventsOffset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.length < 20) setHasMoreEvents(false);
        setEventsList((prev) => [...prev, ...data]);
        setEventsOffset((prev) => prev + 20);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === "all") return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingMore) {
          if (activeTab === "users" && hasMoreUsers) {
            fetchMoreUsers();
          } else if (activeTab === "communities" && hasMoreCommunities) {
            fetchMoreCommunities();
          } else if (activeTab === "events" && hasMoreEvents) {
            fetchMoreEvents();
          }
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = observerRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [activeTab, hasMoreUsers, hasMoreCommunities, hasMoreEvents, usersOffset, communitiesOffset, eventsOffset, isFetchingMore, query, token]);

  // Read URL query parameter on load
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    const qParam = searchParams.get("q");
    if (qParam) {
      setQuery(qParam);
      executeSearch(qParam);
    }
    fetchMetadata();
  }, [isAuthenticated, searchParams, executeSearch, fetchMetadata]);

  // Keyboard shortcut Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch suggestions as user types
  const handleTyping = async (val: string) => {
    setQuery(val);
    if (val.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/suggestions?q=${encodeURIComponent(val)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        setSuggestions(await res.json());
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add search queries to bookmarks
  const handleSaveSearch = async () => {
    if (!query.trim()) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/saved`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ query: query.trim() })
        }
      );
      if (res.ok) {
        showToast("Search query saved successfully!", "success");
        fetchMetadata();
      } else {
        const err = await res.json();
        showToast(err.detail || "Could not save search.", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  // Delete search queries from bookmarks
  const handleDeleteSavedSearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/saved/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        showToast("Saved search bookmark deleted", "success");
        fetchMetadata();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear Search History
  const handleClearHistory = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/search/history`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        showToast("Search history cleared successfully!", "success");
        fetchMetadata();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuggestClick = (val: string) => {
    setQuery(val);
    setShowSuggestions(false);
    executeSearch(val);
  };

  // Direct actions triggers
  const handleStartDM = async (otherUserId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ receiver_id: otherUserId })
        }
      );
      if (res.ok || res.status === 200) {
        showToast("Connected! Redirecting to chat...", "success");
        setTimeout(() => router.push("/dashboard/chat"), 1000);
      } else {
        const err = await res.json();
        showToast(err.detail || "Could not start chat request", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  // Text highlighter component helper
  const highlightText = (text: string | null, term: string) => {
    if (!text) return "";
    if (!term.trim()) return text;
    const regex = new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi");
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="bg-primary/20 text-primary px-0.5 rounded font-bold">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Results totals count
  const resultsCount =
    usersList.length +
    communitiesList.length +
    eventsList.length +
    photosList.length +
    messagesList.length +
    highlightsList.length +
    announcementsList.length;

  // Memoized Results Lists to optimize keystroke typing renders
  const memoizedUsers = useMemo(() => {
    if (usersList.length === 0) return null;
    return (
      <div className="space-y-3">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Participants Discovered</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usersList.map((usr) => (
            <div key={usr.id} className="p-4 rounded-2xl glass-panel border border-white/[0.06] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1b2230] border border-white/[0.08] flex items-center justify-center text-sm font-bold text-white">
                  {usr.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {highlightText(usr.full_name, submittedQuery)}
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    @{highlightText(usr.username, submittedQuery)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartDM(usr.id)}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-cyan-400 text-black text-[10px] font-bold uppercase transition-all"
                >
                  Message
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [usersList, submittedQuery]);

  const memoizedCommunities = useMemo(() => {
    if (communitiesList.length === 0) return null;
    return (
      <div className="space-y-3">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Communities & Clubs</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {communitiesList.map((comm) => (
            <div
              key={comm.id}
              onClick={() => router.push(`/dashboard/my-groups/${comm.id}`)}
              className="rounded-2xl glass-panel border border-white/[0.06] card-hover p-5 cursor-pointer transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-secondary" />
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">{comm.category}</span>
                  <span className="text-sm font-bold text-white block mt-1">
                    {highlightText(comm.title, submittedQuery)}
                  </span>
                </div>
                <Users className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-xs text-gray-400 leading-normal line-clamp-2 mt-2">
                {highlightText(comm.description, submittedQuery)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }, [communitiesList, submittedQuery, router]);

  const memoizedEvents = useMemo(() => {
    if (eventsList.length === 0) return null;
    return (
      <div className="space-y-3">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Events & Photography Walks</span>
        <div className="space-y-3">
          {eventsList.map((evt) => (
            <div
              key={evt.id}
              onClick={() => router.push(`/dashboard/events/${evt.id}`)}
              className="p-4 rounded-2xl glass-panel border border-white/[0.06] hover:bg-white/[0.01] cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-tr from-secondary/10 to-primary/10 border border-white/[0.08] text-primary">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {highlightText(evt.title, submittedQuery)}
                  </span>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-gray-500 font-semibold uppercase">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-600" />
                      <span>{highlightText(evt.location, submittedQuery)}</span>
                    </span>
                    <span>• {new Date(evt.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <button className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] text-xs font-semibold">
                View Event details
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }, [eventsList, submittedQuery, router]);

  const memoizedPhotos = useMemo(() => {
    if (photosList.length === 0) return null;
    return (
      <div className="space-y-3">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">FaceMatch Photo Archives</span>
        <div className="columns-1 md:columns-2 gap-4 space-y-4">
          {photosList.map((p) => (
            <div
              key={p.match_id}
              onClick={() => router.push("/dashboard/my-photos")}
              className="break-inside-avoid rounded-2xl glass-panel border border-white/[0.06] overflow-hidden group cursor-pointer relative"
            >
              <img src={getOptimizedImageUrl(p.file_url, 300)} alt="" className="w-full object-cover transition-all" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">{p.community_title}</span>
                <span className="text-xs font-bold text-white block truncate">{highlightText(p.title || p.album_name || "Personal Gallery Photo", submittedQuery)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [photosList, submittedQuery, router]);

  const memoizedMessages = useMemo(() => {
    if (messagesList.length === 0) return null;
    return (
      <div className="space-y-3">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Direct Chats Occurrences</span>
        <div className="space-y-3">
          {messagesList.map((msg) => (
            <div
              key={msg.id}
              onClick={() => router.push("/dashboard/chat")}
              className="p-4 rounded-2xl glass-panel border border-white/[0.06] hover:bg-white/[0.01] cursor-pointer transition-all flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary/10 to-secondary/10 flex items-center justify-center text-[10px] font-bold text-white">
                  {msg.sender?.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block">
                    {msg.sender?.full_name}
                  </span>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
                    {highlightText(msg.content, submittedQuery)}
                  </p>
                </div>
              </div>
              <span className="text-[9px] text-gray-500 font-semibold whitespace-nowrap">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [messagesList, submittedQuery, router]);

  const memoizedHighlights = useMemo(() => {
    if (highlightsList.length === 0) return null;
    return (
      <div className="space-y-3">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">AI Best Moment Highlights</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {highlightsList.map((album) => (
            <div
              key={album.id}
              className="p-4 rounded-2xl glass-panel border border-white/[0.06] flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-secondary/10 to-primary/10 border border-white/[0.08] flex items-center justify-center text-primary">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {highlightText(album.name, submittedQuery)}
                  </span>
                  <span className="text-[10px] text-gray-500 block truncate mt-0.5">AI Highlights Compilation</span>
                </div>
              </div>

              <button
                onClick={() => router.push(`/dashboard/discover`)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] text-xs font-bold transition-all"
              >
                Open Album
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }, [highlightsList, submittedQuery, router]);

  const memoizedAnnouncements = useMemo(() => {
    if (announcementsList.length === 0) return null;
    return (
      <div className="space-y-3">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Ecosystem Announcements</span>
        <div className="space-y-3">
          {announcementsList.map((ann) => (
            <div key={ann.id} className="p-5 rounded-2xl glass-panel border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">
                  {ann.community?.title || "Community Bulletin"}
                </span>
                <span className="text-[9px] text-gray-600">
                  {new Date(ann.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white font-display">
                {highlightText(ann.title, submittedQuery)}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed pt-1">
                {highlightText(ann.content, submittedQuery)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }, [announcementsList, submittedQuery]);

  return (
    <div className="flex min-h-screen bg-[#030712] text-white">
      
      {/* ====== LEFT SIDEBAR ====== */}
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
          <button
            onClick={() => router.push("/dashboard/timeline")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Activity className="w-4 h-4" />
            <span>Personal Timeline</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/my-photos")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Camera className="w-4 h-4" />
            <span>My Photos</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/chat")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Private Chat</span>
          </button>
        </nav>

        <div className="mt-auto px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-semibold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="text-xs font-semibold text-white block truncate">{user?.full_name}</span>
              <span className="text-[9px] text-gray-500 block truncate font-medium">@{user?.username}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ====== SMART SEARCH WORKSPACE MAIN PANEL ====== */}
      <main className="flex-grow overflow-y-auto min-h-screen">
        
        {/* PREMIUM STICKY HEADER */}
        <div className="sticky top-0 z-30 w-full glass-panel border-b border-white/[0.06] px-8 py-5 flex items-center justify-between gap-6 flex-wrap lg:flex-nowrap">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/[0.08] flex items-center justify-center">
              <Search className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight font-display">
                Intelligent Search
              </h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                Instant Discovery Engine
              </p>
            </div>
          </div>

          {/* DYNAMIC AUTOCOMPLETE FIELD */}
          <form
            onSubmit={(e) => { e.preventDefault(); executeSearch(query); }}
            className="flex-grow max-w-lg relative"
          >
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => handleTyping(e.target.value)}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                placeholder="Type 'Photography', 'My Photos', '/user harsha', '/community'... [Ctrl+K]"
                className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-semibold text-white focus:outline-none focus:border-primary/50 transition-all"
              />
              <span className="absolute right-3.5 top-3 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[8px] font-bold text-gray-500 uppercase tracking-wider">
                Ctrl+K
              </span>
            </div>

            {/* AUTOCOMPLETE SUGGESTIONS DRAWER */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowSuggestions(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute inset-x-0 top-full mt-2 rounded-xl glass-panel border border-white/[0.08] bg-[#070b13] p-2 space-y-1 shadow-2xl z-40 max-h-60 overflow-y-auto divide-y divide-white/[0.02]"
                  >
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestClick(item)}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/[0.04] transition-all flex items-center justify-between"
                      >
                        <span className="text-gray-300 font-medium">{item}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </form>

          {/* BOOKMARK CONTROL BUTTON */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSearch}
              disabled={!query.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-gray-300 font-bold transition-all disabled:opacity-40"
              title="Bookmark this search"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save Query</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE CONTENT GRID */}
        <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* SEARCH LEFT WORKSPACE COLUMN: FILTERS & HISTORY */}
          <div className="space-y-6">
            
            {/* RECENT SEARCHES PANEL */}
            <div className="p-4 rounded-2xl glass-panel border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Recent Searches</span>
                {history.length > 0 && (
                  <button onClick={handleClearHistory} className="text-[9px] text-gray-600 hover:text-red-400 font-bold uppercase">
                    Clear
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <span className="text-[10px] text-gray-500 block leading-normal pt-1">No recent searches.</span>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto divide-y divide-white/[0.02]">
                  {history.map((hist) => (
                    <button
                      key={hist.id}
                      onClick={() => { setQuery(hist.query); executeSearch(hist.query); }}
                      className="w-full text-left py-1.5 text-xs text-gray-400 hover:text-white transition-all truncate block"
                    >
                      🕒 {hist.query}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SAVED SEARCHES (BOOKMARKS) PANEL */}
            <div className="p-4 rounded-2xl glass-panel border border-white/[0.06] space-y-3">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Saved Queries ({savedSearches.length}/15)</span>
              
              {savedSearches.length === 0 ? (
                <span className="text-[10px] text-gray-500 block leading-normal pt-1">Bookmarked searches will appear here.</span>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {savedSearches.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      onClick={() => { setQuery(bookmark.query); executeSearch(bookmark.query); }}
                      className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] flex items-center justify-between gap-3 cursor-pointer transition-all"
                    >
                      <span className="text-xs text-gray-300 font-semibold truncate">📌 {bookmark.query}</span>
                      <button
                        onClick={(e) => handleDeleteSavedSearch(bookmark.id, e)}
                        className="p-1 rounded hover:bg-white/[0.04] text-gray-500 hover:text-red-400"
                        title="Delete Bookmark"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🔥 TRENDING SEARCHES PANEL */}
            <div className="p-4 rounded-2xl glass-panel border border-white/[0.06] space-y-3">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">🔥 Trending Searches</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {trending.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(term); executeSearch(term); }}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-xs font-bold text-gray-300 hover:text-white transition-all uppercase tracking-wide"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* SEARCH RIGHT WORKSPACE COLUMN: TAB SHEETS & CARD FEEDS */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* TABS DRAWER CAROUSEL */}
            <div className="flex rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 overflow-x-auto scrollbar-none">
              {[
                { key: "all", label: "All Results" },
                { key: "users", label: `Participants (${usersList.length})` },
                { key: "communities", label: `Groups (${communitiesList.length})` },
                { key: "events", label: `Events (${eventsList.length})` },
                { key: "photos", label: `Photos (${photosList.length})` },
                { key: "messages", label: `Chats (${messagesList.length})` },
                { key: "highlights", label: `Highlights (${highlightsList.length})` },
                { key: "announcements", label: `Alerts (${announcementsList.length})` }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? "bg-white/[0.06] text-white border border-white/[0.08]"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* RESULTS CONTENT FEED */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-3 h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-sm text-gray-400">Searching ecosystems...</span>
              </div>
            ) : resultsCount === 0 ? (
              /* DYNAMIC EMPTY STATES WITH SUGGESTED RECOMMENDATIONS */
              <div className="rounded-2xl glass-panel border border-white/[0.06] p-10 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-primary mx-auto animate-pulse">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white block">No results found</h3>
                  <span className="text-[10px] text-gray-500 block leading-normal mt-1">
                    Try searching for "photography", "hackathon", "/user harsha", or "my photos".
                  </span>
                </div>

                <div className="border-t border-white/[0.04] pt-6 mt-6 space-y-4">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Recommended Spaces</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => router.push("/dashboard/discover")}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] text-left cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-white block">Explore Communities</span>
                        <span className="text-[10px] text-gray-500 mt-1 block">Find new clubs to join</span>
                      </div>
                      <Compass className="w-4 h-4 text-primary" />
                    </div>

                    <div
                      onClick={() => router.push("/dashboard/my-photos")}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] text-left cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-white block">Biometric Matches</span>
                        <span className="text-[10px] text-gray-500 mt-1 block">Verify photos containing you</span>
                      </div>
                      <Camera className="w-4 h-4 text-secondary" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* 1. MEMBERS GROUP LIST */}
                {(activeTab === "all" || activeTab === "users") && memoizedUsers}

                {/* 2. COMMUNITIES GRID */}
                {(activeTab === "all" || activeTab === "communities") && memoizedCommunities}

                {/* 3. EVENTS DECK */}
                {(activeTab === "all" || activeTab === "events") && memoizedEvents}

                {/* 4. MASONRY PHOTOS GALLERY */}
                {(activeTab === "all" || activeTab === "photos") && memoizedPhotos}

                {/* 5. MESSAGES OCCURRENCES */}
                {(activeTab === "all" || activeTab === "messages") && memoizedMessages}

                {/* 6. HIGHLIGHT ALBUMS */}
                {(activeTab === "all" || activeTab === "highlights") && memoizedHighlights}

                {/* 7. COMMUNITY ANNOUNCEMENTS */}
                {(activeTab === "all" || activeTab === "announcements") && memoizedAnnouncements}

                {/* Sentinel div for Infinite Scroll */}
                {activeTab !== "all" && (activeTab === "users" || activeTab === "communities" || activeTab === "events") && (
                  <div ref={observerRef} className="h-10 flex items-center justify-center py-4">
                    {isFetchingMore && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        <span>Loading more results...</span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      </main>

      {/* TOAST PANEL */}
      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              className={`p-4 rounded-xl border flex items-center gap-3 shadow-2xl backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-bold tracking-tight leading-none">{toast.msg}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
