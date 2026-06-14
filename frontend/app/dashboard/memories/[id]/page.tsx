"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { Calendar, Camera, ChevronLeft, Image as ImageIcon, MapPin, Users, Heart, Download } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface MemoryPhoto {
  photo_id: string;
  url: string;
  confidence: number;
}

interface MemoryDetail {
  id: string;
  title: string;
  description: string;
  memory_type: string;
  memory_date: string;
  cover_url: string;
  photos: MemoryPhoto[];
  people: any[];
  community: any;
}

export default function MemoryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { token, isAuthenticated } = useAuthStore();
  const [memory, setMemory] = useState<MemoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchMemory = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/memories/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setMemory(await res.json());
        } else {
          router.push("/dashboard/memories");
        }
      } catch (err) {
        console.error("Failed to load memory detail", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemory();
  }, [id, isAuthenticated, token, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!memory) return null;

  return (
    <div className="min-h-screen bg-[#030712] text-white pb-20">
      {/* Hero Banner */}
      <div className="relative h-[40vh] md:h-[50vh] w-full overflow-hidden">
        {memory.cover_url ? (
          <img 
            src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/${memory.cover_url}`}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <Camera className="w-12 h-12 text-gray-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/60 to-transparent" />
        
        {/* Back Button */}
        <div className="absolute top-6 left-4 md:left-8 z-10">
          <Link href="/dashboard/memories" className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium">
            <ChevronLeft className="w-4 h-4" /> Back to Timeline
          </Link>
        </div>

        {/* Title Info */}
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 max-w-7xl mx-auto">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 rounded-md bg-primary/20 border border-primary/30 text-[11px] font-bold text-primary uppercase tracking-wider">
                {memory.memory_type}
              </span>
              {memory.memory_date && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-white/5 px-2.5 py-1 rounded-md border border-white/10 backdrop-blur-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(memory.memory_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-2 leading-tight">
              {memory.title}
            </h1>
            {memory.description && (
              <p className="text-gray-300 max-w-2xl text-sm md:text-base leading-relaxed">
                {memory.description}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-10 mt-8">
        
        {/* Stats Strip */}
        <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] pb-8 mb-8">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-tertiary" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Photos</p>
              <p className="text-lg font-bold text-gray-100">{memory.photos.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">People Present</p>
              <p className="text-lg font-bold text-gray-100">AI Processing...</p>
            </div>
          </div>
          
          <button className="ml-auto px-5 py-3 rounded-xl bg-primary text-[#030712] font-semibold text-sm hover:bg-cyan-400 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Download Album
          </button>
        </div>

        {/* Gallery */}
        <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
          Memory Gallery
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {memory.photos.map((photo, i) => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              key={photo.photo_id} 
              className="relative aspect-square rounded-xl overflow-hidden group border border-white/[0.04]"
            >
              <img 
                src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/${photo.url}`} 
                alt="Memory Photo" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100">
                <div className="flex justify-end">
                  <span className="text-[9px] font-bold bg-black/60 px-2 py-1 rounded text-primary border border-primary/30 backdrop-blur-md">
                    {Math.round(photo.confidence * 100)}% MATCH
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <button className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md">
                    <Heart className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {memory.photos.length === 0 && (
          <div className="text-center py-20 border border-dashed border-white/[0.1] rounded-2xl bg-white/[0.02]">
            <Camera className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400">No photos in this memory yet</h3>
          </div>
        )}
      </div>
    </div>
  );
}
