"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, Download, Check, Sparkles, Loader2, 
  Grid2X2, Grid3X3, Image as ImageIcon, CheckCircle2 
} from "lucide-react";

interface Match {
  photo_id: string;
  filename: string;
  storage_path: string;
  confidence: number;
  bbox: number[]; // [ymin, xmin, ymax, xmax]
}

export default function MatchGallery() {
  const params = useParams();
  const router = useRouter();
  const { token, isAuthenticated } = useAuthStore();
  const eventId = params.id as string;

  // State Management
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [cols, setCols] = useState(3); // Column layout selector
  const [hoveredPhotoId, setHoveredPhotoId] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<Record<string, { width: number; height: number }>>({});

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    const loadMatches = async () => {
      // 1. Check sessionStorage first for instant render
      const storedMatches = sessionStorage.getItem(`facesnap_matches_${eventId}`);
      if (storedMatches) {
        try {
          const parsed = JSON.parse(storedMatches);
          if (parsed && parsed.length > 0) {
            setMatches(parsed);
            setSelectedIds(parsed.map((p: Match) => p.photo_id));
            return;
          }
        } catch (err) {
          console.error("Failed to parse matched photos from cache:", err);
        }
      }

      // 2. Fetch directly from backend results endpoint as robust persistence fallback
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/results/${eventId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setMatches(data);
          setSelectedIds(data.map((p: Match) => p.photo_id));
          sessionStorage.setItem(`facesnap_matches_${eventId}`, JSON.stringify(data));
        }
      } catch (err) {
        console.error("Failed to load verification results from database:", err);
      }
    };

    loadMatches();
  }, [eventId, isAuthenticated, router, token]);

  const toggleSelect = (photoId: string) => {
    setSelectedIds((prev) => 
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(matches.map((p) => p.photo_id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleDownload = async () => {
    if (selectedIds.length === 0) return;

    setIsDownloading(true);
    setDownloadSuccess(false);

    // Get list of URLs corresponding to selected IDs
    const selectedUrls = matches
      .filter((p) => selectedIds.includes(p.photo_id))
      .map((p) => p.storage_path);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(selectedUrls)
      });

      if (!response.ok) {
        throw new Error("Failed to download ZIP file.");
      }

      // Read streamed bytes
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Trigger dynamic browser download
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `facesnap_memories_${eventId}.zip`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setDownloadSuccess(true);
    } catch (err) {
      console.error("ZIP download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
        
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
          <button onClick={() => router.push("/dashboard")} className="hover:text-gray-50 transition-colors" type="button">
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          <button onClick={() => router.push(`/dashboard/events/${eventId}`)} className="hover:text-gray-50 transition-colors" type="button">
            Event
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          <span className="text-gray-50 font-medium">Gallery</span>
        </nav>

        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-600 mb-6">
              <ImageIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-display font-semibold text-gray-50">No Memories Found</h2>
            <p className="mt-3 text-base text-gray-400 leading-relaxed">
              No photos in this event matched your biometric parameters. Check if the host has completed indexing uploads.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* GALLERY CONTROL BAR */}
            <div className="p-4 rounded-xl glass-panel border border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/[0.08] border border-primary/15 text-primary">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-gray-50 font-display leading-none">
                    AI Search Results
                  </h1>
                  <span className="text-sm text-gray-400 block mt-0.5">
                    {matches.length} matched {matches.length === 1 ? "photo" : "photos"}
                  </span>
                </div>
              </div>

              {/* CONTROLS */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.08] p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:text-gray-50 hover:bg-white/[0.06] transition-all"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-50 hover:bg-white/[0.06] transition-all"
                  >
                    Clear
                  </button>
                </div>

                {/* GRID VIEW TOGGLE */}
                <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.08] p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCols(2)}
                    aria-label="Two column grid"
                    className={`p-1.5 rounded-md transition-all ${cols === 2 ? "bg-primary text-[#030712]" : "text-gray-500 hover:text-gray-50"}`}
                  >
                    <Grid2X2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCols(3)}
                    aria-label="Three column grid"
                    className={`p-1.5 rounded-md transition-all ${cols === 3 ? "bg-primary text-[#030712]" : "text-gray-500 hover:text-gray-50"}`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* ZIP DOWNLOAD BUTTON */}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={selectedIds.length === 0 || isDownloading}
                  className="h-10 flex items-center gap-2 px-5 rounded-lg text-sm font-semibold bg-primary hover:bg-cyan-400 text-[#030712] disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download ({selectedIds.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Download success alert */}
            {downloadSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary font-medium" role="alert">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>ZIP photopack downloaded! Check your downloads folder.</span>
              </div>
            )}

            {/* PHOTO GRID */}
            <div className={`grid gap-4 ${
              cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}>
              {matches.map((photo, i) => {
                const isSelected = selectedIds.includes(photo.photo_id);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    whileHover={{ scale: 1.01 }}
                    key={photo.photo_id}
                    onMouseEnter={() => setHoveredPhotoId(photo.photo_id)}
                    onMouseLeave={() => setHoveredPhotoId(null)}
                    onClick={() => toggleSelect(photo.photo_id)}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Photo ${photo.filename}, ${(photo.confidence * 100).toFixed(0)}% match`}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleSelect(photo.photo_id); }}}
                    className={`relative rounded-xl overflow-hidden glass-panel cursor-pointer group transition-all duration-300 border ${
                      isSelected ? "border-primary/60 ring-1 ring-primary/20" : "border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    
                    {/* CONFIDENCE MATCH BADGE */}
                    <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-primary/25 text-xs font-semibold text-primary">
                      {(photo.confidence * 100).toFixed(0)}%
                    </div>

                    {/* SELECT BOX INDICATOR */}
                    <div className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? "bg-primary border-primary text-[#030712]" : "bg-black/50 border-white/20 text-transparent"
                    }`}>
                      <Check className="w-3.5 h-3.5 stroke-[3px]" />
                    </div>

                    {/* IMAGE CONTAINER */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0a0f1a]">
                      <img
                        src={photo.storage_path}
                        alt={photo.filename}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        loading="lazy"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setImageDims((prev) => ({
                            ...prev,
                            [photo.photo_id]: { width: img.naturalWidth, height: img.naturalHeight }
                          }));
                        }}
                      />
                      
                      {/* Realtime Face Bounding Box Highlight on Hover */}
                      <AnimatePresence>
                        {hoveredPhotoId === photo.photo_id && (() => {
                          const dims = imageDims[photo.photo_id];
                          let top = "25%";
                          let left = "35%";
                          let width = "30%";
                          let height = "40%";

                          if (dims && photo.bbox && photo.bbox.length === 4) {
                            const [ymin, xmin, ymax, xmax] = photo.bbox;
                            top = `${(ymin / dims.height) * 100}%`;
                            left = `${(xmin / dims.width) * 100}%`;
                            width = `${((xmax - xmin) / dims.width) * 100}%`;
                            height = `${((ymax - ymin) / dims.height) * 100}%`;
                          }

                          return (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute border-2 border-primary/60 rounded-md pointer-events-none z-20"
                              style={{ top, left, width, height, boxShadow: "0 0 8px rgba(6,182,212,0.2)" }}
                            />
                          );
                        })()}
                      </AnimatePresence>
                    </div>

                    {/* METADATA BAR */}
                    <div className="px-4 py-3 border-t border-white/[0.04] flex items-center justify-between">
                      <span className="text-sm text-gray-300 truncate max-w-[180px]">{photo.filename}</span>
                      <span className="text-xs text-gray-600">FaceSnap AI</span>
                    </div>

                  </motion.div>
                );
              })}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
