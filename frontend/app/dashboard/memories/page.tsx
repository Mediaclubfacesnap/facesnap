"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { Search, Calendar, Users, Camera, PlayCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface MemoryCollection {
  id: string;
  title: string;
  description: string;
  memory_type: string;
  memory_date: string;
  photo_count: number;
  people_count: number;
  cover_url: string;
}

interface TimelineYear {
  year: number;
  collections: MemoryCollection[];
}

export default function MemoriesTimelinePage() {
  const { token, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [timeline, setTimeline] = useState<TimelineYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    const fetchMemories = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/memories`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setTimeline(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch memories", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemories();
  }, [isAuthenticated, token, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const filteredTimeline = timeline.map(yearGroup => ({
    ...yearGroup,
    collections: yearGroup.collections.filter(c => 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })).filter(yearGroup => yearGroup.collections.length > 0);

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Hero Section */}
      <div className="relative pt-24 pb-12 overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-tertiary/10 opacity-30" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-50 to-gray-400"
          >
            Your AI Memory Timeline
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto"
          >
            Relive your best moments. FaceSnap automatically organizes your photos into events, trips, and communities.
          </motion.p>

          <div className="mt-8 max-w-md mx-auto relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
            <input 
              type="text"
              placeholder="Search memories (e.g. Graduation 2026)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] focus:border-primary/50 text-white placeholder:text-gray-500 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {filteredTimeline.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300">No memories found</h3>
            <p className="text-gray-500 mt-2">Upload more photos or adjust your search.</p>
          </div>
        ) : (
          <div className="space-y-16 relative">
            {/* Timeline Line */}
            <div className="absolute left-4 md:left-[50%] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-white/[0.08] to-transparent hidden md:block" />

            {filteredTimeline.map((yearGroup, yearIndex) => (
              <div key={yearGroup.year} className="relative z-10">
                {/* Year Marker */}
                <div className="flex items-center justify-start md:justify-center mb-8 sticky top-20 z-20">
                  <div className="px-6 py-2 rounded-full glass-panel border border-primary/30 bg-[#0a0f1a]/80 backdrop-blur-md shadow-lg shadow-primary/10">
                    <span className="text-2xl font-bold text-primary">{yearGroup.year}</span>
                  </div>
                </div>

                {/* Collections Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {yearGroup.collections.map((collection, index) => (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      key={collection.id}
                      className="group relative rounded-2xl overflow-hidden glass-panel border border-white/[0.08] hover:border-primary/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 cursor-pointer"
                      onClick={() => router.push(`/dashboard/memories/${collection.id}`)}
                    >
                      {/* Cover Photo */}
                      <div className="aspect-[4/3] relative overflow-hidden bg-gray-900">
                        {collection.cover_url ? (
                          <img 
                            src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/${collection.cover_url}`} 
                            alt={collection.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                            <Camera className="w-8 h-8 text-gray-700" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        
                        {/* Play Icon Overlay (Cinematic feel) */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <PlayCircle className="w-6 h-6 text-white" />
                          </div>
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                            {collection.memory_type}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 relative bg-gradient-to-b from-transparent to-[#0a0f1a]/90">
                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">
                          {collection.title}
                        </h3>
                        {collection.memory_date && (
                          <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(collection.memory_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs font-medium text-gray-400 border-t border-white/[0.06] pt-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-tertiary" />
                            {collection.photo_count} Photos
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-secondary" />
                            {collection.people_count} People
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
