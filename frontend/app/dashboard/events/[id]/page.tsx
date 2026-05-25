"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import {
  ChevronRight, MapPin, Calendar, ShieldCheck,
  Loader2, Camera, Eye, FileText, Upload, Radio, Archive
} from "lucide-react";

interface EventData {
  id: string;
  community_id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  status: string;
  cover_url?: string | null;
}

const statusConfig: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  draft: { icon: FileText, color: "text-gray-400 bg-gray-500/10 border-gray-500/20", label: "Draft" },
  uploading: { icon: Upload, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Uploading" },
  processing: { icon: Loader2, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", label: "Processing" },
  live: { icon: Radio, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Live" },
  archived: { icon: Archive, color: "text-gray-500 bg-gray-600/10 border-gray-600/20", label: "Archived" },
};

export default function PublicEventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchEvent();
  }, [eventId, isAuthenticated]);

  const fetchEvent = async () => {
    try {
      const eventRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${eventId}`);
      if (!eventRes.ok) throw new Error("Event not found");
      const eventData = await eventRes.json();
      setEvent(eventData);
    } catch (err) {
      console.error("Failed to load event for public overview:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  const status = event ? (statusConfig[event.status] || statusConfig.draft) : statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6" aria-label="Breadcrumb">
          <button onClick={() => router.push("/dashboard")} className="hover:text-gray-50 transition-colors" type="button">
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          {event && (
            <>
              <button onClick={() => router.push(`/dashboard/communities/${event.community_id}`)} className="hover:text-gray-50 transition-colors" type="button">
                Community
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            </>
          )}
          <span className="text-gray-50 font-medium truncate">{event?.title || "Event"}</span>
        </nav>

        {isLoading || !event ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-sm text-gray-400">
              Loading event details...
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event Banner */}
            <div className="relative h-72 rounded-2xl overflow-hidden border border-white/[0.06]">
              {event.cover_url ? (
                <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover opacity-30" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/[0.08] to-tertiary/[0.06]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/70 to-transparent" />

              {/* Status Badge */}
              <div className="absolute top-5 right-5">
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>

              {/* Title Overlay */}
              <div className="absolute bottom-6 left-6 right-6">
                <h1 className="text-3xl font-display font-bold text-gray-50">
                  {event.title}
                </h1>
              </div>
            </div>

            {/* Event Metadata Card */}
            <div className="p-6 rounded-xl glass-panel border border-white/[0.06]">
              <p className="text-base text-gray-400 leading-relaxed mb-5">
                {event.description}
              </p>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-primary/[0.08]">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Location</span>
                    <span className="text-sm text-gray-200 font-medium">{event.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-secondary/[0.08]">
                    <Calendar className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Date</span>
                    <span className="text-sm text-gray-200 font-medium">{event.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-emerald-500/[0.08]">
                    <Eye className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">AI Status</span>
                    <span className="text-sm text-emerald-400 font-medium">Indexed & Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Find My Photos CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-2xl glass-panel border border-primary/15 max-w-2xl mx-auto text-center space-y-5"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/[0.08] border border-primary/15 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-display font-semibold text-gray-50">Find My Photos</h3>
                <p className="text-base text-gray-400 max-w-md mx-auto leading-relaxed">
                  FaceSnap uses realtime biometric face verification with anti-spoofing to locate all photos you appear in.
                </p>
              </div>
              
              <button
                type="button"
                onClick={() => router.push(`/dashboard/events/${eventId}/verify`)}
                className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-primary hover:bg-cyan-400 text-[#030712] text-base font-semibold transition-all w-full max-w-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Camera className="w-5 h-5" />
                <span>Start Face Verification</span>
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
