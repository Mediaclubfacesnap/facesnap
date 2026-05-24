"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Shield, Search, Zap, Users, Download, ChevronDown, Sparkles,
  ArrowRight, Cpu, CheckCircle, Database, Lock, ScanFace, Globe, Star,
  ArrowUpRight, HelpCircle, Timer, Fingerprint, Package, MapPin
} from "lucide-react";

interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  event_count?: number;
  banner_url?: string | null;
}

export default function RootLandingPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  // Background Interactive Neural Network Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Custom interactive HUD state
  const [scanStep, setScanStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [livenessScore, setLivenessScore] = useState(0);
  const [embeddingsFound, setEmbeddingsFound] = useState(false);

  // Dynamic status text for neural HUD scanner
  const getScanStatusText = (progress: number) => {
    if (progress === 0) return "Awaiting selfie upload...";
    if (progress < 25) return "Extracting 68 facial landmarks...";
    if (progress < 50) return "Computing EAR (Eye Aspect Ratio) liveness...";
    if (progress < 80) return "Generating 512-D neural face embedding...";
    if (progress < 100) return "Performing pgvector HNSW cosine match...";
    return "Verification Secure // 18 matches unlocked!";
  };

  // Run a mock scan demo in the glass device widget
  useEffect(() => {
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          setEmbeddingsFound(true);
          setTimeout(() => {
            setScanProgress(0);
            setEmbeddingsFound(false);
          }, 4000); // Wait 4 seconds before resetting the demo scan
          return 100;
        }
        return prev + 2;
      });
    }, 80);

    return () => clearInterval(interval);
  }, []);

  // Set randomized liveness score during scan
  useEffect(() => {
    if (scanProgress > 45 && scanProgress < 80) {
      setLivenessScore(parseFloat((0.95 + Math.random() * 0.048).toFixed(4)));
    } else if (scanProgress >= 80) {
      setLivenessScore(0.9982);
    } else {
      setLivenessScore(0);
    }
  }, [scanProgress]);

  // Fetch active communities from FastAPI
  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/v1/communities`);
        if (res.ok) {
          const data = await res.json();
          setCommunities(data);
        }
      } catch (err) {
        console.error("Failed to fetch communities from backend:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCommunities();
  }, []);

  // Neural Connection Background Particles Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }> = [];

    // Create particles — reduced count for performance
    const particleCount = Math.min(35, Math.floor(width / 40));
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw network nodes and connections
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off bounds
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Node Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = idx % 2 === 0 ? "rgba(6, 182, 212, 0.18)" : "rgba(244, 63, 94, 0.12)";
        ctx.fill();

        // Connect adjacent nodes with gradient lines
        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.06;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = idx % 2 === 0 
              ? `rgba(6, 182, 212, ${alpha})` 
              : `rgba(244, 63, 94, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

  const faqItems = [
    {
      q: "How does the AI matching mechanism work?",
      a: "FaceSnap uploads a high-precision biometric selfie, extracts 68 facial points, generates an encrypted 512-dimensional vector embedding, and queries our pgvector HNSW database using cosine distance metrics to retrieve photos under 300ms."
    },
    {
      q: "Is my biometric privacy protected?",
      a: "Absolutely. We strictly enforce on-the-fly ephemeral verification. Biometric vectors are evaluated in sandbox memories to resolve matches, and face vector embeddings are never sold or tied to government identities."
    },
    {
      q: "Can I host events and upload photos as a contributor?",
      a: "Yes! Any authorized community contributor can instantiate a custom event gallery, bulk upload images, and trigger our PyTorch face segmentation pipeline in background processing queues."
    }
  ];

  const stepIcons = [MapPin, Fingerprint, Cpu, Package];

  return (
    <div className="relative min-h-screen bg-[#030712] text-gray-50 font-body overflow-hidden">
      {/* 1. BACKGROUND NEURAL NETWORK SYSTEM */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
        <canvas ref={canvasRef} className="w-full h-full block" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#030712]/90 to-[#030712]" />
        {/* Ambient radial spotlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.03)_0%,transparent_70%)] blur-[100px]" />
      </div>

      {/* 2. HEADER BRANDING */}
      <header className="relative z-50 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/[0.06]" role="banner">
        <Link href="/" className="flex items-center gap-3 group" aria-label="FaceSnap home">
          <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-secondary/15 to-primary/15 border border-white/[0.08] group-hover:border-primary/30 transition-all duration-300">
            <Camera className="w-5 h-5 text-primary group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <span className="text-xl font-display font-bold tracking-tight text-gray-50">
            FaceSnap
          </span>
        </Link>

        <nav className="flex items-center gap-3" aria-label="Header navigation">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-gray-400 hover:text-gray-50 transition-colors py-2 px-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="glow-btn-primary text-sm font-semibold text-[#030712] bg-primary hover:bg-cyan-400 py-2.5 px-6 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712]"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* 3. HERO SECTION */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* HERO LEFT */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
              <span className="text-xs font-medium text-gray-400 tracking-wide">
                AI Memory Retrieval System Active
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.05]">
              Find Every{" "}
              <span className="text-gradient-primary">
                Memory
              </span>
              <br />
              You Were Part Of.
            </h1>

            <p className="text-base sm:text-lg text-gray-400 max-w-xl leading-relaxed">
              FaceSnap utilizes secure, cloud-ephemeral biometric verification to instantly scan 512-dimensional vector graphs and unlock every photo you appear in.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link
                href="/auth/signup"
                className="hero-btn-scan glow-btn-primary flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-primary text-[#030712] font-semibold text-base transition-all hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712]"
              >
                <Camera className="w-5 h-5 flex-shrink-0" />
                <span>Find My Photos</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/auth/signup"
                className="hero-btn-upload flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-secondary/30 text-gray-50 font-semibold text-base transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <Sparkles className="w-5 h-5 text-secondary flex-shrink-0" />
                <span>Register Event</span>
              </Link>
            </div>

            {/* Quick trust metrics */}
            <div className="pt-8 grid grid-cols-3 gap-8 border-t border-white/[0.06] max-w-lg">
              <div>
                <span className="text-2xl font-display font-bold text-primary block">&lt;300ms</span>
                <span className="text-xs text-gray-500 font-medium block mt-1.5">Search Speed</span>
              </div>
              <div>
                <span className="text-2xl font-display font-bold text-gray-50 block">99.8%</span>
                <span className="text-xs text-gray-500 font-medium block mt-1.5">Accuracy Rate</span>
              </div>
              <div>
                <span className="text-2xl font-display font-bold text-secondary block">Secure</span>
                <span className="text-xs text-gray-500 font-medium block mt-1.5">Anti-Spoofing</span>
              </div>
            </div>
          </div>

          {/* HERO RIGHT: Neural scan simulation widget */}
          <div className="lg:col-span-5 flex justify-center items-center" aria-hidden="true">
            <div className="relative glass-panel-cyan rounded-2xl p-6 max-w-sm w-full border border-white/[0.08] overflow-hidden group">
              {/* Scan beam */}
              <div 
                className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent z-10 pointer-events-none" 
                style={{
                  top: `${scanProgress}%`,
                  opacity: scanProgress > 0 && scanProgress < 100 ? 0.8 : 0,
                  transition: "opacity 0.2s",
                  boxShadow: "0 0 12px rgba(6, 182, 212, 0.4)"
                }}
              />

              {/* HUD Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-xs font-mono tracking-wider text-primary font-medium">
                    BIOMETRIC SCAN
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500">{scanProgress}%</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                </div>
              </div>

              {/* Central scanning outline */}
              <div className="relative h-60 bg-[#030712]/60 rounded-xl border border-white/[0.04] flex items-center justify-center overflow-hidden mb-4">
                <div className="absolute inset-0 bg-dot-pattern opacity-[0.04]" />
                
                {/* Face Outline */}
                <div className="relative w-40 h-40 rounded-full border border-white/[0.1] flex items-center justify-center">
                  <div className="absolute inset-3 rounded-full border border-primary/20 flex items-center justify-center">
                    <ScanFace className={`w-12 h-12 ${embeddingsFound ? "text-emerald-400" : "text-primary/70"} transition-colors duration-500`} />
                  </div>
                  {/* Rotating ring */}
                  <div className="absolute inset-[-6px] rounded-full border border-primary/20 animate-spin-slow" style={{ borderStyle: 'dashed' }} />
                </div>

                {/* Liveness match alert */}
                {embeddingsFound && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-x-4 bottom-4 p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/25 text-emerald-400 text-center font-mono text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>LIVENESS MATCH: EAR OK (99.82%)</span>
                  </motion.div>
                )}
              </div>

              {/* Console readout */}
              <div className="p-4 rounded-xl bg-[#030712]/80 border border-white/[0.04] font-mono text-xs text-left space-y-2">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-2 text-gray-500">
                  <span className="text-xs">CONSOLE</span>
                </div>
                <div className="space-y-1.5 text-emerald-400/70">
                  <div className="flex items-center gap-1.5">
                    <span className="text-primary">✓</span>
                    <span>Biometric Camera Stream Connected</span>
                  </div>
                  {scanProgress >= 25 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5">
                      <span className="text-primary">✓</span>
                      <span>Facial landmarks extracted (68 points)</span>
                    </motion.div>
                  )}
                  {scanProgress >= 50 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5">
                      <span className="text-primary">✓</span>
                      <span>Liveness score: {livenessScore || "Calculating..."}</span>
                    </motion.div>
                  )}
                  {scanProgress >= 80 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5">
                      <span className="text-primary">✓</span>
                      <span>512-D Embedding generated</span>
                    </motion.div>
                  )}
                </div>
                <div className="text-primary font-medium mt-3 flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  <span>{getScanStatusText(scanProgress)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. SEPARATOR MARQUEE */}
        <section className="mt-32 py-5 border-y border-white/[0.04] overflow-hidden w-screen relative left-[50%] right-[50%] -ml-[50vw] -mr-[50vw]" aria-hidden="true">
          <div className="flex items-center gap-10 whitespace-nowrap animate-marquee">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-10 text-sm font-medium tracking-wide text-gray-600">
                <span>Fast Vector Matches</span>
                <span className="text-gray-700">·</span>
                <span>Anti-Spoofing Algorithms</span>
                <span className="text-gray-700">·</span>
                <span>Supabase PostgreSQL Storage</span>
                <span className="text-gray-700">·</span>
                <span>Zero Trust Verification</span>
                <span className="text-gray-700">·</span>
                <span>pgvector Index</span>
                <span className="text-gray-700">·</span>
                <span>PyTorch MTCNN Engine</span>
                <span className="text-gray-700">·</span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. COMMUNITIES SECTION */}
        <section className="mt-28" aria-labelledby="communities-heading">
          <div className="text-center mb-14 space-y-4">
            <span className="inline-flex items-center text-xs font-medium text-primary tracking-wide px-4 py-1.5 bg-primary/[0.08] border border-primary/20 rounded-full">
              FaceSnap Hubs
            </span>
            <h2 id="communities-heading" className="text-3xl sm:text-4xl font-display font-bold text-gray-50">
              Active Community Ecosystems
            </h2>
            <p className="text-base text-gray-400 max-w-lg mx-auto">
              Explore dynamic photo retrieval hubs configured across verified networks.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="h-48 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {communities.length > 0 ? (
                communities.map((comm) => (
                  <Link
                    key={comm.id}
                    href={`/dashboard/communities/${comm.id}`}
                    className="group rounded-xl glass-panel p-6 border border-white/[0.06] card-hover flex flex-col justify-between text-left"
                  >
                    {/* Accent bar */}
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-primary/40 via-tertiary/30 to-transparent rounded-t-xl" />
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-primary/[0.08]">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-50 group-hover:text-primary transition-colors">
                        {comm.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                        {comm.description || "Active community workspace hosting retrievals."}
                      </p>
                    </div>
                    <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-gray-500">
                      <span className="font-mono tracking-wide">
                        {comm.slug}
                      </span>
                      {comm.event_count !== undefined && (
                        <span className="font-medium text-gray-300">
                          {comm.event_count} Events
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <>
                  {[
                    { name: "Neural Developers Lab", desc: "Interactive computational labs evaluating facial segmentations and embedding matrices.", color: "text-primary" },
                    { name: "Creative Studio Network", desc: "Collaborative digital design agency mapping UI breakpoint guidelines and HIG/Material specs.", color: "text-tertiary" },
                    { name: "Photography Expo Global", desc: "Consolidated portfolio archives mapping active galleries and public memory indexes.", color: "text-secondary" }
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-xl glass-panel p-6 border border-white/[0.06] text-left relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-primary/30 to-transparent rounded-t-xl" />
                      <div className="p-2 rounded-lg bg-white/[0.04] inline-flex mb-4">
                        <Users className={`w-4 h-4 ${item.color}`} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-50">{item.name}</h3>
                      <p className="text-sm text-gray-400 mt-2 leading-relaxed">{item.desc}</p>
                      <div className="mt-5 pt-4 border-t border-white/[0.04] text-xs text-gray-600 font-mono">
                        Offline Mode
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        {/* 6. HOW IT WORKS */}
        <section className="mt-32" aria-labelledby="how-it-works-heading">
          <div className="text-center mb-16 space-y-4">
            <span className="inline-flex items-center text-xs font-medium text-primary tracking-wide px-4 py-1.5 bg-primary/[0.08] border border-primary/20 rounded-full">
              Pipeline Flow
            </span>
            <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl font-display font-bold text-gray-50">
              How FaceSnap Works
            </h2>
            <p className="text-base text-gray-400 max-w-lg mx-auto">
              Four steps from selfie to photo retrieval — powered by neural embeddings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { step: 1, title: "Locate Hub", desc: "Select an active community ecosystem or public event." },
              { step: 2, title: "Selfie Verify", desc: "Authenticate via live secure webcam capture." },
              { step: 3, title: "Generate Embeddings", desc: "AI translates pixels to deep vector landmarks." },
              { step: 4, title: "Download Photos", desc: "Instantly claim high-res ZIPs containing your face." }
            ].map((s, idx) => {
              const Icon = stepIcons[idx];
              return (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.4 }}
                  className="relative rounded-xl glass-panel p-6 border border-white/[0.06] text-left group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/[0.08] border border-primary/15 flex items-center justify-center text-sm font-display font-bold text-primary">
                      {s.step}
                    </div>
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-50 mb-1.5">{s.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                  
                  {/* Step connector line */}
                  {idx < 3 && (
                    <div className="hidden lg:block absolute top-[38px] -right-3 w-6 h-[1px] bg-gradient-to-r from-primary/25 to-transparent" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 7. FAQ ACCORDION */}
        <section className="mt-32 max-w-3xl mx-auto" aria-labelledby="faq-heading">
          <div className="text-center mb-12">
            <h2 id="faq-heading" className="text-2xl sm:text-3xl font-display font-bold text-gray-50">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3" role="list">
            {faqItems.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] transition-colors overflow-hidden"
                role="listitem"
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                  className="w-full py-5 px-6 flex items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  aria-expanded={faqOpen === idx}
                  aria-controls={`faq-answer-${idx}`}
                  type="button"
                >
                  <span className="text-base font-medium text-gray-50 pr-4">{item.q}</span>
                  <ChevronDown 
                    className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-300 ${faqOpen === idx ? "rotate-180 text-primary" : ""}`} 
                  />
                </button>
                <AnimatePresence initial={false}>
                  {faqOpen === idx && (
                    <motion.div
                      id={`faq-answer-${idx}`}
                      role="region"
                      aria-labelledby={`faq-question-${idx}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="pb-5 px-6 text-sm text-gray-400 border-t border-white/[0.04] pt-4 leading-relaxed">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

        {/* 8. NEWSLETTER FORM */}
        <section className="mt-32 max-w-3xl mx-auto rounded-2xl glass-panel p-8 sm:p-12 border border-white/[0.08] relative overflow-hidden text-center" aria-labelledby="newsletter-heading">
          <div className="absolute top-0 right-0 w-[250px] h-[250px] rounded-full bg-secondary/[0.02] blur-[80px] pointer-events-none" aria-hidden="true" />
          
          <div className="relative z-10 max-w-lg mx-auto space-y-6">
            <div className="w-12 h-12 rounded-xl bg-primary/[0.08] flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h2 id="newsletter-heading" className="text-2xl sm:text-3xl font-display font-bold text-gray-50">
              Stay in the Loop
            </h2>
            <p className="text-base text-gray-400 leading-relaxed">
              Get notified about security updates, model releases, and performance improvements.
            </p>

            <AnimatePresence mode="wait">
              {!subscribed ? (
                <motion.form 
                  onSubmit={handleSubscribe} 
                  className="flex flex-col sm:flex-row gap-3 pt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email address for newsletter"
                    className="flex-grow px-4 py-3 h-12 rounded-xl bg-[#0a0f1a] border border-white/[0.08] hover:border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary/30 text-base text-gray-50 placeholder-gray-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    className="glow-btn-primary px-6 h-12 rounded-xl bg-primary text-[#030712] font-semibold text-sm transition-all hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Subscribe
                  </button>
                </motion.form>
              ) : (
                <motion.div 
                  className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-sm flex items-center justify-center gap-2 font-medium"
                  role="alert"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>You&apos;re subscribed! We&apos;ll keep you updated.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* 9. FOOTER */}
      <footer className="relative z-20 border-t border-white/[0.06] bg-[#030712]/90 py-14 px-6" role="contentinfo">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10 text-left">
          
          {/* Col 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/[0.08] border border-primary/15">
                <Camera className="w-4 h-4 text-primary" />
              </div>
              <span className="text-base font-display font-bold text-gray-50">FaceSnap</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Biometric face retrieval and neural segmentation platform for communities and public directories.
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">Facial Verification</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">pgvector HNSW</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">Liveness Protocol</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Security</h4>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">Zero-Trust Sandbox</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">Ephemeral Vectors</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">Biometric Guard</a></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">Documentation</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">API Reference</a></li>
              <li><a href="#" className="text-sm text-gray-400 hover:text-gray-50 transition-colors">System Status</a></li>
            </ul>
          </div>
        </div>

        {/* Legal footer */}
        <div className="max-w-7xl mx-auto pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-gray-500">
            © 2026 FaceSnap AI Inc. All rights reserved.
          </span>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms of Service</a>
            <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Security Audit</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
