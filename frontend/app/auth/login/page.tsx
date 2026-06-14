"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { validateEmail, getEmailFeedback } from "@/lib/emailValidation";
import { Camera, Mail, Lock, ArrowRight, Loader2, AlertCircle, Check, X } from "lucide-react";

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

export default function Login() {
  const router = useRouter();
  const loginStore = useAuthStore((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Real-time email validation feedback
  const emailFeedback = getEmailFeedback(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    // Frontend email validation gate
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setErrorMessage(emailValidation.error || "Invalid email address.");
      setIsLoading(false);
      return;
    }

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
      router.replace("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Connection failure. Backend may be offline.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account"
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || "Google sign-in initiation failed.");
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
                placeholder="you@gmail.com"
                aria-describedby="login-email-hint"
                aria-invalid={email.length > 0 && emailFeedback.status === "invalid" ? "true" : undefined}
                className={`w-full h-12 pl-11 pr-10 rounded-lg bg-[#0a0f1a] border focus:ring-1 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors duration-200 font-body ${
                  email.length > 0 && emailFeedback.status === "valid"
                    ? "border-emerald-500/40 focus:border-emerald-500 focus:ring-emerald-500/20"
                    : email.length > 3 && emailFeedback.status === "invalid"
                    ? "border-rose-500/40 focus:border-rose-500 focus:ring-rose-500/20"
                    : "border-white/[0.08] focus:border-cyan-500 focus:ring-cyan-500/30"
                }`}
              />
              {/* Inline status icon */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {email.length > 0 && emailFeedback.status === "valid" && (
                  <Check className="w-4 h-4 text-emerald-400" />
                )}
                {email.length > 3 && emailFeedback.status === "invalid" && (
                  <X className="w-4 h-4 text-rose-400" />
                )}
              </div>
            </div>
            {/* Inline feedback message */}
            {email.length > 3 && emailFeedback.status !== "idle" && (
              <p
                id="login-email-hint"
                className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${
                  emailFeedback.status === "valid" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {emailFeedback.message}
              </p>
            )}
            {/* Allowed providers hint (shown when field is empty / idle) */}
            {email.length === 0 && (
              <p className="mt-1.5 text-[11px] text-gray-500">
                Accepted: Gmail, Outlook, Hotmail only
              </p>
            )}
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
                className="w-full h-12 pl-11 pr-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors duration-200 font-body"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || (email.length > 3 && emailFeedback.status === "invalid")}
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

        {/* Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-white/[0.08]"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0c1220] px-3.5 py-1 rounded-full border border-white/[0.06] text-gray-400 font-body font-semibold">Or continue with</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full h-12 flex items-center justify-center bg-[#0d1220] hover:bg-[#12192c] border border-white/[0.08] hover:border-white/[0.15] text-gray-300 hover:text-white font-semibold text-base rounded-lg font-display transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

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
