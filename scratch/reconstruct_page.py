import os
import json
import re

log_path = r"C:\Users\nagen\.gemini\antigravity\brain\57e3efb3-c423-4058-9112-38b7fd134b80\.system_generated\logs\transcript.jsonl"
part1 = ""
part2 = ""

# Step 1: Scan logs for the two view_file outputs
try:
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                step = json.loads(line)
                content = step.get("content", "")
                
                # Check if it's the first view_file call (Showing lines 1 to 800)
                if "Showing lines 1 to 800" in content:
                    part1 = content
                # Check if it's the second view_file call (Showing lines 801 to 1033)
                elif "Showing lines 801 to 1033" in content:
                    part2 = content
            except Exception:
                continue
except Exception as e:
    print(f"Error reading logs: {e}")

def parse_code_block(text):
    if not text:
        return ""
    lines = []
    # Loop over each line in the text and match "123: original_line"
    for line in text.splitlines():
        match = re.match(r"^\s*(\d+):\s?(.*)$", line)
        if match:
            # We preserve leading spaces of the original code, which is in group 2
            lines.append(match.group(2))
    return "\n".join(lines)

code_part1 = parse_code_block(part1)
code_part2 = parse_code_block(part2)

print(f"Part 1 length parsed: {len(code_part1)} characters")
print(f"Part 2 length parsed: {len(code_part2)} characters")

if not code_part1 or not code_part2:
    print("ERROR: Failed to extract one or both parts of page.tsx from logs.")
    exit(1)

# Join the parts
original_code = code_part1 + "\n" + code_part2
print(f"Reconstructed original code length: {len(original_code)} characters")

# Step 2: Apply our custom visual redesign edits on the reconstructed file
# 1. Add getTerminalStatus mapping helper and the new HUD refs
original_code = original_code.replace(
    'const footerLinks = {\n  Product: ["AI Verification", "Event Workspaces", "Memory Search", "Face Embeddings"],\n  Platform: ["Communities", "Events", "Contributors", "Analytics"],\n  Resources: ["Documentation", "API Reference", "System Status", "Changelog"],\n  Company: ["About", "Blog", "Careers", "Contact"],\n};\n\nexport default function Home() {\n  const [showSplash, setShowSplash] = useState(true);\n  const [splashProgress, setSplashProgress] = useState(0);\n  const [openFaq, setOpenFaq] = useState<number | null>(null);\n  const [waitlistEmail, setWaitlistEmail] = useState("");\n  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);\n\n  const canvasRef = useRef<HTMLCanvasElement>(null);\n  const mouseRef = useRef({ x: -1000, y: -1000 });\n\n  const splashContainerRef = useRef<HTMLDivElement>(null);\n  const splashLogoRef = useRef<HTMLDivElement>(null);\n  const splashTextRef = useRef<HTMLHeadingElement>(null);\n  const splashBarRef = useRef<HTMLDivElement>(null);\n  const heroPillRef = useRef<HTMLDivElement>(null);\n  const heroHeadingRef = useRef<HTMLHeadingElement>(null);\n  const heroSubRef = useRef<HTMLParagraphElement>(null);\n  const heroButtonsRef = useRef<HTMLDivElement>(null);\n  const heroDockRef = useRef<HTMLDivElement>(null);',
    'const footerLinks = {\n  Product: ["AI Verification", "Event Workspaces", "Memory Search", "Face Embeddings"],\n  Platform: ["Communities", "Events", "Contributors", "Analytics"],\n  Resources: ["Documentation", "API Reference", "System Status", "Changelog"],\n  Company: ["About", "Blog", "Careers", "Contact"],\n};\n\nconst getTerminalStatus = (progress: number) => {\n  if (progress < 15) return "Initializing neural tensor arrays...";\n  if (progress < 35) return "Mapping 512-D face embedding vector space...";\n  if (progress < 60) return "Booting Liveness Anti-Spoof Protocol (EAR)...";\n  if (progress < 85) return "Connecting local pgvector HNSW database...";\n  if (progress < 100) return "Compiling cinematic shaders & web host...";\n  return "System operational. Loading Cinematic OS...";\n};\n\nexport default function Home() {\n  const [showSplash, setShowSplash] = useState(true);\n  const [splashProgress, setSplashProgress] = useState(0);\n  const [openFaq, setOpenFaq] = useState<number | null>(null);\n  const [waitlistEmail, setWaitlistEmail] = useState("");\n  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);\n\n  const canvasRef = useRef<HTMLCanvasElement>(null);\n  const mouseRef = useRef({ x: -1000, y: -1000 });\n\n  const splashContainerRef = useRef<HTMLDivElement>(null);\n  const splashLogoRef = useRef<HTMLDivElement>(null);\n  const splashTextRef = useRef<HTMLHeadingElement>(null);\n  const splashBarRef = useRef<HTMLDivElement>(null);\n  const heroPillRef = useRef<HTMLDivElement>(null);\n  const heroHeadingRef = useRef<HTMLHeadingElement>(null);\n  const heroSubRef = useRef<HTMLParagraphElement>(null);\n  const heroButtonsRef = useRef<HTMLDivElement>(null);\n  const heroDockRef = useRef<HTMLDivElement>(null);\n\n  // New Holographic HUD Aperture refs\n  const hudOuterRingRef = useRef<SVGSVGElement>(null);\n  const hudInnerRingRef = useRef<SVGSVGElement>(null);\n  const hudCenterRef = useRef<HTMLDivElement>(null);\n  const hudScannerBeamRef = useRef<HTMLDivElement>(null);'
)

# 2. Add Spline and Loader2 imports at top
original_code = original_code.replace(
    'import React, { useState, useEffect, useRef } from "react";\nimport { gsap } from "gsap";\nimport Link from "next/link";\nimport Navbar from "@/components/Navbar";\nimport { motion, AnimatePresence } from "framer-motion";\nimport {\n  Camera, ArrowRight, Sparkles, Globe, Calendar, ScanFace, Download,\n  Star, ChevronDown, Mail, Shield, Cpu, Eye, Zap, Users, Brain,\n  Lock, Search, CircleDot, ArrowUpRight\n} from "lucide-react";',
    'import React, { useState, useEffect, useRef } from "react";\nimport dynamic from "next/dynamic";\nimport { gsap } from "gsap";\nimport Link from "next/link";\nimport Navbar from "@/components/Navbar";\nimport { motion, AnimatePresence } from "framer-motion";\nimport {\n  Camera, ArrowRight, Sparkles, Globe, Calendar, ScanFace, Download,\n  Star, ChevronDown, Mail, Shield, Cpu, Eye, Zap, Users, Brain,\n  Lock, Search, CircleDot, ArrowUpRight, Loader2\n} from "lucide-react";\n\nconst Spline = dynamic(() => import("@splinetool/react-spline/dist/react-spline"), {\n  ssr: false,\n  loading: () => (\n    <div className="w-full h-full flex items-center justify-center">\n      <Loader2 className="w-7 h-7 text-accentCyan animate-spin" />\n    </div>\n  ),\n});'
)

# 3. Replace the useEffect timeline block
old_effect = """  // 1. Cinematic GSAP Splash and Hero Reveal Timeline
  useEffect(() => {
    // Force immediate scroll to top on mount for cinematic entry
    window.scrollTo(0, 0);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setShowSplash(false);
        }
      });

      // 1. Splash Screen Intro Timeline
      tl.fromTo(
        splashContainerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: "power2.out" }
      );

      tl.fromTo(
        splashLogoRef.current,
        { scale: 0.8, opacity: 0, rotationY: -90 },
        { scale: 1, opacity: 1, rotationY: 0, duration: 0.85, ease: "back.out(1.5)" },
        "-=0.3"
      );

      // Staggered character reveal
      const chars = splashTextRef.current?.querySelectorAll("span") || [];
      if (chars.length > 0) {
        tl.fromTo(
          chars,
          { y: 35, opacity: 0, filter: "blur(5px)" },
          { y: 0, opacity: 1, filter: "blur(0px)", stagger: 0.05, duration: 0.75, ease: "power3.out" },
          "-=0.55"
        );
      }

      // Smooth progress bar fill
      tl.to(splashBarRef.current, {
        width: "100%",
        duration: 2.2,
        ease: "power1.inOut",
        onUpdate: function () {
          setSplashProgress(Math.round(this.progress() * 100));
        }
      }, "-=0.3");

      // 2. Splash Screen Exit & Hero Screen Reveal (Coordinated)
      tl.to(splashLogoRef.current, {
        scale: 1.15,
        opacity: 0,
        filter: "blur(10px)",
        duration: 0.6,
        ease: "power2.in"
      });

      tl.to(
        splashContainerRef.current,
        {
          opacity: 0,
          scale: 1.05,
          filter: "blur(15px)",
          duration: 0.7,
          ease: "power3.inOut"
        },
        "-=0.45"
      );

      // Hero Elements Reveal (starts slightly before splash fully fades out)
      tl.fromTo(
        heroPillRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.8)" },
        "-=0.3"
      );

      // Split text reveal for main hero heading
      const headingLines = heroHeadingRef.current?.querySelectorAll("span") || [];
      if (headingLines.length > 0) {
        tl.fromTo(
          headingLines,
          { y: 80, opacity: 0, rotateX: -15, skewY: 2 },
          { y: 0, opacity: 1, rotateX: 0, skewY: 0, stagger: 0.12, duration: 0.95, ease: "power4.out" },
          "-=0.4"
        );
      }

      tl.fromTo(
        heroSubRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
        "-=0.6"
      );

      const buttons = heroButtonsRef.current?.children || [];
      tl.fromTo(
        buttons,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.1, duration: 0.55, ease: "back.out(1.4)" },
        "-=0.55"
      );

      const dockItems = heroDockRef.current?.children || [];
      tl.fromTo(
        dockItems,
        { y: 35, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, stagger: 0.1, duration: 0.75, ease: "power3.out" },
        "-=0.6"
      );
    });

    return () => ctx.revert();
  }, []);"""

new_effect = """  // 1. Cinematic GSAP Splash and Hero Reveal Timeline
  useEffect(() => {
    // Force immediate scroll to top on mount for cinematic entry
    window.scrollTo(0, 0);

    const ctx = gsap.context(() => {
      // Immediate infinite HUD animations
      gsap.to(hudOuterRingRef.current, {
        rotation: 360,
        duration: 16,
        repeat: -1,
        ease: "none"
      });

      gsap.to(hudInnerRingRef.current, {
        rotation: -360,
        duration: 10,
        repeat: -1,
        ease: "none"
      });

      gsap.fromTo(
        hudScannerBeamRef.current,
        { y: -100 },
        {
          y: 100,
          duration: 2.2,
          repeat: -1,
          yoyo: true,
          ease: "power2.inOut"
        }
      );

      gsap.to(hudCenterRef.current, {
        scale: 1.08,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut"
      });

      const tl = gsap.timeline({
        onComplete: () => {
          setShowSplash(false);
        }
      });

      // 1. Splash Screen Intro Timeline
      tl.fromTo(
        splashContainerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: "power2.out" }
      );

      tl.fromTo(
        splashLogoRef.current,
        { scale: 0.8, opacity: 0, rotationY: -90 },
        { scale: 1, opacity: 1, rotationY: 0, duration: 0.85, ease: "back.out(1.5)" },
        "-=0.3"
      );

      // Staggered character reveal with neon decrypt effect
      const chars = splashTextRef.current?.querySelectorAll(".decrypt-char") || [];
      if (chars.length > 0) {
        tl.fromTo(
          chars,
          { y: 35, opacity: 0, filter: "blur(5px)", color: "#00e5ff" },
          { 
            y: 0, 
            opacity: 1, 
            filter: "blur(0px)", 
            color: "#ffffff",
            stagger: 0.08, 
            duration: 0.85, 
            ease: "power3.out" 
          },
          "-=0.55"
        );
      }

      // Smooth progress bar fill
      tl.to(splashBarRef.current, {
        width: "100%",
        duration: 2.5,
        ease: "power1.inOut",
        onUpdate: function () {
          setSplashProgress(Math.round(this.progress() * 100));
        }
      }, "-=0.3");

      // 2. Splash Screen Exit & Hero Screen Reveal (Coordinated)
      tl.to(hudCenterRef.current, {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: "back.in(1.7)"
      });

      tl.to(splashLogoRef.current, {
        scale: 1.15,
        opacity: 0,
        filter: "blur(12px)",
        duration: 0.6,
        ease: "power2.in"
      }, "-=0.3");

      tl.to(
        splashContainerRef.current,
        {
          opacity: 0,
          scale: 1.08,
          filter: "blur(20px)",
          duration: 0.8,
          ease: "power3.inOut"
        },
        "-=0.5"
      );

      // Hero Elements Reveal (starts slightly before splash fully fades out)
      tl.fromTo(
        heroPillRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.8)" },
        "-=0.35"
      );

      // Split text reveal for main hero heading with a gorgeous overflow reveal
      const headingLines = heroHeadingRef.current?.querySelectorAll(".hero-line-span") || [];
      if (headingLines.length > 0) {
        tl.fromTo(
          headingLines,
          { y: 100, opacity: 0, rotateX: -15, skewY: 2 },
          { y: 0, opacity: 1, rotateX: 0, skewY: 0, stagger: 0.15, duration: 1.1, ease: "power4.out" },
          "-=0.45"
        );
      }

      tl.fromTo(
        heroSubRef.current,
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
        "-=0.65"
      );

      const buttons = heroButtonsRef.current?.children || [];
      tl.fromTo(
        buttons,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.12, duration: 0.65, ease: "back.out(1.4)" },
        "-=0.6"
      );

      const dockItems = heroDockRef.current?.children || [];
      tl.fromTo(
        dockItems,
        { y: 40, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, stagger: 0.12, duration: 0.85, ease: "power3.out" },
        "-=0.65"
      );
    });

    return () => ctx.revert();
  }, []);"""

# Direct replacement on string
original_code = original_code.replace(old_effect, new_effect)

# 4. Replace the HTML blocks
old_html = """      {/* ========== 1. CINEMATIC INTRO SPLASH ========== */}
      {showSplash && (
        <div
          ref={splashContainerRef}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-3xl"
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Premium cinematic glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accentCyan/[0.02] blur-[140px]"></div>
            <div className="absolute top-1/3 left-1/3 w-[420px] h-[420px] rounded-full bg-accentRed/[0.02] blur-[110px]"></div>

            {/* Animated grid field */}
            <div className="absolute inset-0 opacity-40">
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 120 120"
                preserveAspectRatio="none"
              >
                {/* vertical lines */}
                {[...Array(13)].map((_, i) => {
                  const x = 5 + i * 9;
                  return (
                    <line
                      key={`v-${i}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={120}
                      stroke="rgba(0, 229, 255, 0.12)"
                      strokeWidth="0.5"
                    />
                  );
                })}

                {/* horizontal lines */}
                {[...Array(10)].map((_, i) => {
                  const y = 10 + i * 11;
                  return (
                    <line
                      key={`h-${i}`}
                      x1={0}
                      y1={y}
                      x2={120}
                      y2={y}
                      stroke="rgba(255, 60, 120, 0.08)"
                      strokeWidth="0.5"
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          <div
            ref={splashLogoRef}
            className="relative flex flex-col items-center gap-6 z-10"
          >
            {/* Icon card */}
            <div className="relative p-4 rounded-2xl bg-gradient-to-tr from-accentRed/20 to-accentCyan/20 border border-white/10">
              <Camera className="w-10 h-10 text-accentCyan animate-pulse" />
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-accentCyan/10 blur-xl animate-pulse"
              />
            </div>

            <div className="text-center">
              {/* Premium title reveal */}
              <h1
                ref={splashTextRef}
                className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-white via-white to-accentCyan bg-clip-text text-transparent font-satoshi"
              >
                {"FaceSnap".split("").map((char, index) => (
                  <span key={index} className="inline-block opacity-0" style={{ transform: "translateY(35px)" }}>
                    {char}
                  </span>
                ))}
              </h1>

              <div className="mt-3">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] animate-pulse" />
                  <p className="text-[10px] tracking-[0.3em] text-accentRed font-bold uppercase whitespace-nowrap">
                    Premium AI Memory Retrieval
                  </p>
                </div>

                <p
                  className="text-[9px] text-secondaryText font-medium mt-2 tracking-wide"
                >
                  Liveness verified • Fast pgvector match
                </p>
              </div>
            </div>

            <p className="text-xs text-secondaryText font-medium tracking-wide max-w-xs text-center">
              Find Every Memory You Were Part Of.
            </p>

            {/* Progress */}
            <div className="w-48 h-1 rounded-full bg-white/5 overflow-hidden mt-2">
              <div
                ref={splashBarRef}
                className="h-full bg-gradient-to-r from-accentRed to-accentCyan rounded-full"
                style={{ width: "0%" }}
              />
            </div>

            {/* Glowing status text */}
            <span
              className="text-[9px] text-secondaryText tracking-widest uppercase font-bold"
            >
              Initializing Neural Pipeline...
            </span>
          </div>
        </div>
      )}

      <Navbar />

      {/* ========== 2. HERO SECTION ========== */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-4">
        {/* Ambient glow effects */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-accentCyan/[0.04] blur-[120px]"></div>
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-accentRed/[0.04] blur-[100px]"></div>

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-accentCyan/20 animate-float-particle"
            style={{
              top: `${20 + i * 12}%`,
              left: `${10 + i * 15}%`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div>
            <div 
              ref={heroPillRef}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 opacity-0"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"></div>
              <span className="text-[10px] font-bold text-secondaryText tracking-widest uppercase">
                AI Neural Engine Active
              </span>
            </div>

            <h1 
              ref={heroHeadingRef}
              className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.95] font-satoshi"
            >
              <div className="overflow-hidden inline-block w-full">
                <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent inline-block opacity-0" style={{ transform: "translateY(80px)" }}>
                  Find Every Memory
                </span>
              </div>
              <br />
              <div className="overflow-hidden inline-block w-full">
                <span className="bg-gradient-to-r from-accentCyan via-accentCyan to-accentCyan/60 bg-clip-text text-transparent inline-block opacity-0" style={{ transform: "translateY(80px)" }}>
                  You Were Part Of.
                </span>
              </div>
            </h1>

            <p 
              ref={heroSubRef}
              className="mt-6 text-sm md:text-base text-secondaryText max-w-2xl mx-auto leading-relaxed opacity-0"
              style={{ transform: "translateY(20px)" }}
            >
              FaceSnap uses realtime AI face verification to instantly retrieve memories
              across events, communities, and contributor ecosystems.
            </p>
          </div>

          <div
            ref={heroButtonsRef}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
          >
            <Link
              href="/auth/signup"
              className="hero-btn-scan glow-btn-cyan relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-accentCyan text-black font-bold text-sm border border-accentCyan/50 transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,229,255,0.3)] opacity-0"
              style={{ transform: "scale(0.9)" }}
            >
              <Camera className="w-5 h-5" />
              <span>Find My Photos</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/signup"
              className="hero-btn-upload relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:border-accentRed/30 text-white font-bold text-sm transition-all duration-300 hover:bg-white/10 opacity-0"
              style={{ transform: "scale(0.9)" }}
            >
              <Sparkles className="w-5 h-5 text-accentRed" />
              <span>Create Event</span>
            </Link>
          </div>

          {/* Holographic Dock Preview */}
          <div
            ref={heroDockRef}
            className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <div className="px-5 py-4 rounded-2xl glass-panel-cyan flex items-center gap-3 min-w-[200px] opacity-0" style={{ transform: "translateY(35px)" }}>
              <Shield className="w-5 h-5 text-accentCyan flex-shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-white block">Liveness Protocol</span>
                <span className="text-[9px] text-secondaryText">EAR Anti-Spoof Active</span>
              </div>
            </div>

            <div className="relative w-16 h-16 rounded-full border-2 border-accentCyan/30 flex items-center justify-center opacity-0" style={{ transform: "translateY(35px)" }}>
              <div className="absolute inset-0 rounded-full border border-accentCyan/10 animate-ping"></div>
              <ScanFace className="w-7 h-7 text-accentCyan" />
            </div>

            <div className="px-5 py-4 rounded-2xl glass-panel flex items-center gap-3 min-w-[200px] opacity-0" style={{ transform: "translateY(35px)" }}>
              <Search className="w-5 h-5 text-accentRed flex-shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-white block">pgvector Search</span>
                <span className="text-[9px] text-secondaryText">HNSW Cosine Index</span>
              </div>
            </div>
          </div>
        </div>
      </section>"""

new_html = """      {/* ========== 1. CINEMATIC INTRO SPLASH ========== */}
      {showSplash && (
        <div
          ref={splashContainerRef}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/75 backdrop-blur-3xl"
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Premium cinematic glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accentCyan/[0.04] blur-[140px]"></div>
            <div className="absolute top-1/3 left-1/3 w-[420px] h-[420px] rounded-full bg-accentRed/[0.04] blur-[110px]"></div>

            {/* Animated grid field */}
            <div className="absolute inset-0 opacity-40">
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 120 120"
                preserveAspectRatio="none"
              >
                {/* vertical lines */}
                {[...Array(13)].map((_, i) => {
                  const x = 5 + i * 9;
                  return (
                    <line
                      key={`v-${i}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={120}
                      stroke="rgba(0, 229, 255, 0.12)"
                      strokeWidth="0.5"
                    />
                  );
                })}

                {/* horizontal lines */}
                {[...Array(10)].map((_, i) => {
                  const y = 10 + i * 11;
                  return (
                    <line
                      key={`h-${i}`}
                      x1={0}
                      y1={y}
                      x2={120}
                      y2={y}
                      stroke="rgba(255, 60, 120, 0.08)"
                      strokeWidth="0.5"
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          <div
            ref={splashLogoRef}
            className="relative flex flex-col items-center gap-7 z-10"
          >
            {/* ========== HIGH-TECH HOLOGRAPHIC HUD APERTURE SCANNER ========== */}
            <div className="relative w-64 h-64 flex items-center justify-center select-none">
              {/* Outer Dashed HUD Ring */}
              <svg
                ref={hudOuterRingRef}
                className="absolute w-full h-full text-accentCyan/35 drop-shadow-[0_0_15px_rgba(0,229,255,0.25)]"
                viewBox="0 0 200 200"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="92"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="16 12"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  strokeOpacity="0.5"
                />
              </svg>

              {/* Inner Dashed HUD Ring */}
              <svg
                ref={hudInnerRingRef}
                className="absolute w-[80%] h-[80%] text-accentRed/35 drop-shadow-[0_0_12px_rgba(255,60,120,0.25)]"
                viewBox="0 0 160 160"
              >
                <circle
                  cx="80"
                  cy="80"
                  r="72"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="4 6 20 6"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  strokeOpacity="0.4"
                />
              </svg>

              {/* Center Pulsing Iris Lens / Interactive 3D Spline Logo */}
              <div
                ref={hudCenterRef}
                className="relative w-44 h-44 rounded-full border border-white/15 flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-md shadow-[0_0_30px_rgba(0,229,255,0.15)]"
              >
                <div className="absolute inset-0 rounded-full bg-accentCyan/5 blur-lg" />
                <div className="w-full h-full scale-[1.05] pointer-events-auto flex items-center justify-center z-10">
                  <Spline scene="https://prod.spline.design/27B8kRro0JQXS6py/scene.splinecode" />
                </div>
              </div>

              {/* Glowing vertical laser scanner beam */}
              <div
                ref={hudScannerBeamRef}
                className="absolute left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] pointer-events-none z-20"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>

            <div className="text-center">
              {/* Premium decrypting title reveal */}
              <h1
                ref={splashTextRef}
                className="text-4xl font-extrabold tracking-wider bg-gradient-to-r from-white via-white to-accentCyan bg-clip-text text-transparent font-satoshi"
              >
                {"FaceSnap".split("").map((char, index) => (
                  <span key={index} className="decrypt-char inline-block opacity-0" style={{ transform: "translateY(35px)" }}>
                    {char}
                  </span>
                ))}
              </h1>

              <div className="mt-3">
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.03)]"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] animate-pulse" />
                  <p className="text-[9px] tracking-[0.3em] text-accentRed font-bold uppercase whitespace-nowrap">
                    Premium AI Memory Retrieval
                  </p>
                </div>
              </div>
            </div>

            {/* MONOSPACE REALTIME TERMINAL CONSOLE FEED */}
            <div className="w-80 p-4 rounded-xl bg-black/45 border border-white/5 font-mono text-left space-y-1.5 shadow-[inset_0_2px_12px_rgba(0,0,0,0.8)] backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <span className="text-[10px] text-accentCyan/80 tracking-wider font-bold">SYS_DECRYPT // ACTIVE</span>
                <span className="text-[10px] text-accentRed font-bold">{splashProgress}%</span>
              </div>
              <div className="h-[76px] overflow-hidden flex flex-col justify-end text-[9px] leading-relaxed text-emerald-500/80">
                {splashProgress >= 15 && (
                  <div className="opacity-60 flex items-center gap-1.5">
                    <span className="text-accentCyan">[✓]</span> SYS_INIT :: neural tensor arrays compiled.
                  </div>
                )}
                {splashProgress >= 35 && (
                  <div className="opacity-60 flex items-center gap-1.5">
                    <span className="text-accentCyan">[✓]</span> SYS_EMBED :: 512-D vector space mapped.
                  </div>
                )}
                {splashProgress >= 60 && (
                  <div className="opacity-60 flex items-center gap-1.5">
                    <span className="text-accentCyan">[✓]</span> SYS_LIVENESS :: Anti-Spoof Protocol (EAR) active.
                  </div>
                )}
                {splashProgress >= 85 && (
                  <div className="opacity-60 flex items-center gap-1.5">
                    <span className="text-accentCyan">[✓]</span> SYS_DB :: pgvector HNSW index initialized.
                  </div>
                )}
                <div className="text-accentCyan animate-pulse flex items-center gap-1.5 mt-1 font-semibold">
                  <span className="text-accentRed font-bold animate-ping">●</span> [SYS_DECRYPT] {getTerminalStatus(splashProgress)}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-56 h-1 rounded-full bg-white/5 overflow-hidden mt-1">
              <div
                ref={splashBarRef}
                className="h-full bg-gradient-to-r from-accentRed to-accentCyan rounded-full shadow-[0_0_8px_rgba(0,229,255,0.5)]"
                style={{ width: "0%" }}
              />
            </div>
          </div>
        </div>
      )}

      <Navbar />

      {/* ========== 2. HERO SECTION ========== */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-4">
        {/* Ambient glow effects */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-accentCyan/[0.04] blur-[120px]"></div>
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-accentRed/[0.04] blur-[100px]"></div>

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-accentCyan/20 animate-float-particle"
            style={{
              top: `${20 + i * 12}%`,
              left: `${10 + i * 15}%`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div>
            <div 
              ref={heroPillRef}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 opacity-0"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"></div>
              <span className="text-[10px] font-bold text-secondaryText tracking-widest uppercase">
                AI Neural Engine Active
              </span>
            </div>

            <h1 
              ref={heroHeadingRef}
              className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.95] font-satoshi"
            >
              <div className="overflow-hidden inline-block w-full py-2">
                <span className="hero-line-span bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent inline-block opacity-0" style={{ transform: "translateY(100px)" }}>
                  Find Every Memory
                </span>
              </div>
              <br />
              <div className="overflow-hidden inline-block w-full py-2">
                <span className="hero-line-span bg-gradient-to-r from-accentCyan via-accentCyan to-accentCyan/60 bg-clip-text text-transparent inline-block opacity-0" style={{ transform: "translateY(100px)" }}>
                  You Were Part Of.
                </span>
              </div>
            </h1>

            <p 
              ref={heroSubRef}
              className="mt-6 text-sm md:text-base text-secondaryText max-w-2xl mx-auto leading-relaxed opacity-0"
              style={{ transform: "translateY(25px)" }}
            >
              FaceSnap uses realtime AI face verification to instantly retrieve memories
              across events, communities, and contributor ecosystems.
            </p>
          </div>

          <div
            ref={heroButtonsRef}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
          >
            <Link
              href="/auth/signup"
              className="hero-btn-scan glow-btn-cyan relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-accentCyan text-black font-bold text-sm border border-accentCyan/50 transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,229,255,0.3)] opacity-0"
              style={{ transform: "scale(0.9)" }}
            >
              <Camera className="w-5 h-5" />
              <span>Find My Photos</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/signup"
              className="hero-btn-upload relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:border-accentRed/30 text-white font-bold text-sm transition-all duration-300 hover:bg-white/10 opacity-0"
              style={{ transform: "scale(0.9)" }}
            >
              <Sparkles className="w-5 h-5 text-accentRed" />
              <span>Create Event</span>
            </Link>
          </div>

          {/* Holographic Dock Preview */}
          <div
            ref={heroDockRef}
            className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <div className="px-5 py-4 rounded-2xl glass-panel-cyan flex items-center gap-3 min-w-[200px] opacity-0" style={{ transform: "translateY(40px)" }}>
              <Shield className="w-5 h-5 text-accentCyan flex-shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-white block">Liveness Protocol</span>
                <span className="text-[9px] text-secondaryText">EAR Anti-Spoof Active</span>
              </div>
            </div>

            <div className="relative w-16 h-16 rounded-full border-2 border-accentCyan/30 flex items-center justify-center opacity-0" style={{ transform: "translateY(40px)" }}>
              <div className="absolute inset-0 rounded-full border border-accentCyan/10 animate-ping"></div>
              <ScanFace className="w-7 h-7 text-accentCyan" />
            </div>

            <div className="px-5 py-4 rounded-2xl glass-panel flex items-center gap-3 min-w-[200px] opacity-0" style={{ transform: "translateY(40px)" }}>
              <Search className="w-5 h-5 text-accentRed flex-shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-white block">pgvector Search</span>
                <span className="text-[9px] text-secondaryText">HNSW Cosine Index</span>
              </div>
            </div>
          </div>
        </div>
      </section>"""

original_code = original_code.replace(old_html, new_html)

# Save the fully reconstructed code
target_path = r"c:\Users\nagen\facesnap2\frontend\app\page.tsx"
with open(target_path, "w", encoding="utf-8") as out:
    out.write(original_code)

print("\nRECONSTRUCTION PROCESS COMPLETE: Re-saved page.tsx with full changes!")
