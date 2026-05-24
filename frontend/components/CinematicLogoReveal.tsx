"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  brightness: number;
}

interface CinematicLogoRevealProps {
  onComplete: () => void;
}

export default function CinematicLogoReveal({ onComplete }: CinematicLogoRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Dense white floating particles (5000 stars)
    const particleCount = 5000;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 5,
        y: (Math.random() - 0.5) * height * 5,
        z: Math.random() * 3000,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        brightness: Math.random() * 50 + 50,
      });
    }

    let speed = 1;
    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Deep black background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      particles.forEach((p) => {
        // Move particles in 3D space
        p.z -= speed;
        if (p.z < 1) {
          p.z = 3000;
          p.x = (Math.random() - 0.5) * width * 5;
          p.y = (Math.random() - 0.5) * height * 5;
        }

        // Perspective Projection
        const factor = 800 / p.z;
        const x2d = width / 2 + p.x * factor;
        const y2d = height / 2 + p.y * factor;
        const size = p.size * factor;

        // Radial composition check
        if (x2d > -100 && x2d < width + 100 && y2d > -100 && y2d < height + 100) {
          const alpha = p.opacity * (1 - p.z / 3000);
          
          // Pure white glowing stars
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
          ctx.fill();

          // Subtle bloom for closer stars
          if (p.z < 1000) {
            ctx.shadowBlur = size * 2;
            ctx.shadowColor = "white";
            ctx.fill();
            ctx.shadowBlur = 0;
          }

          // Motion blur trails during zoom
          if (speed > 15) {
            const angle = Math.atan2(y2d - height / 2, x2d - width / 2);
            const trailLength = speed * factor * 0.15;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
            ctx.lineWidth = size;
            ctx.beginPath();
            ctx.moveTo(x2d, y2d);
            ctx.lineTo(
              x2d + Math.cos(angle) * trailLength,
              y2d + Math.sin(angle) * trailLength
            );
            ctx.stroke();
          }
        }
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    // Cinematic Reveal Timeline
    const tl = gsap.timeline({
      delay: 0.5,
      onComplete: () => {
        setTimeout(onComplete, 2500);
      }
    });

    // 1. Slow immersive drift
    tl.to({ val: 1 }, {
      val: 2,
      duration: 2,
      ease: "power1.inOut",
      onUpdate: function() { speed = this.targets()[0].val; }
    });

    // 2. High-speed cinematic zoom (dolly forward)
    tl.to({ val: 2 }, {
      val: 80,
      duration: 2.5,
      ease: "power3.in",
      onUpdate: function() { speed = this.targets()[0].val; }
    });

    // 3. Reveal Text centerpiece
    tl.call(() => {
      setShowLogo(true);
    }, [], "-=0.8");

    // 4. Smooth easing into slow float
    tl.to({ val: 80 }, {
      val: 0.4,
      duration: 4,
      ease: "power4.out",
      onUpdate: function() { speed = this.targets()[0].val; }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      <AnimatePresence>
        {showLogo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(30px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(20px)" }}
            transition={{ duration: 2.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
          >
            {/* Minimal Premium Text Centerpiece */}
            <div className="relative group">
              <h1 className="text-8xl md:text-[10rem] font-black tracking-tighter text-white font-sfpro select-none text-center">
                <span className="relative inline-block animate-float-slow">
                  FaceSnap
                  {/* Layered Bloom Glows */}
                  <span className="absolute inset-0 text-white blur-xl opacity-40 -z-10">FaceSnap</span>
                  <span className="absolute inset-0 text-white blur-[60px] opacity-20 -z-20">FaceSnap</span>
                </span>
              </h1>
              
              {/* Metallic / Glass sheen effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-transparent mix-blend-overlay pointer-events-none"></div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1.5 }}
              className="mt-12 flex flex-col items-center"
            >
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
              <span className="mt-4 text-[10px] font-bold tracking-[0.6em] text-white/50 uppercase">
                Future of Memories
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Atmospheric Post-Processing */}
      <div className="absolute inset-0 pointer-events-none bg-radial-gradient from-transparent via-transparent to-black opacity-90"></div>
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,1)]"></div>
    </div>
  );
}
