"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Camera, Mail, Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const loginStore = useAuthStore((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      loginStore(data.user, data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Connection failure. Backend may be offline.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center py-16 px-4 relative min-h-screen bg-[#030712]">
      {/* Decorative gradient orb */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] -z-10"
      />

      <div className="w-full max-w-lg p-8 rounded-2xl glass-panel relative overflow-hidden">
        {/* Gradient top border */}
        <div
          aria-hidden="true"
          className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 to-violet-500"
        />

        {/* Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-4 group justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-lg"
            aria-label="Go to FaceSnap home"
          >
            <Camera className="w-6 h-6 text-cyan-500 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-lg font-bold tracking-wider text-gray-50 font-display">FaceSnap</span>
          </Link>
          <h2 className="text-2xl font-display font-bold tracking-tight text-gray-50">
            Welcome Back
          </h2>
          <p className="mt-2 text-base text-gray-400 font-body">
            Sign in to your FaceSnap account
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            id="login-error"
            role="alert"
            aria-live="polite"
            className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400 font-medium leading-relaxed flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-300 mb-1.5 font-body"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@facesnap.ai"
                aria-invalid={errorMessage ? "true" : undefined}
                aria-describedby={errorMessage ? "login-error" : undefined}
                className="w-full h-12 pl-11 pr-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors duration-200 font-body"
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-300 mb-1.5 font-body"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                aria-invalid={errorMessage ? "true" : undefined}
                aria-describedby={errorMessage ? "login-error" : undefined}
                className="w-full h-12 pl-11 pr-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors duration-200 font-body"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-[#030712] font-semibold text-base rounded-lg font-display transition-all duration-200 mt-6 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712]"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-400 font-body">
          New to FaceSnap?{" "}
          <Link
            href="/auth/signup"
            className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded"
          >
            Create Account
          </Link>
        </p>
      </div>
    </main>
  );
}
