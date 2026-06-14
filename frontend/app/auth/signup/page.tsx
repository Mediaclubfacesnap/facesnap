"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { Camera, Mail, Lock, User, Sparkles, Loader2, AtSign, Check, X, AlertCircle, ArrowRight } from "lucide-react";

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


export default function Signup() {
  const router = useRouter();
  const loginStore = useAuthStore((state) => state.login);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Username validation states
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameMessage, setUsernameMessage] = useState("");

  // Password strength indicator
  const passwordStrength = useMemo(() => {
    const len = password.length;
    if (len === 0) return 0;
    if (len < 4) return 1;
    if (len < 8) return 2;
    if (len < 12) return 3;
    return 4;
  }, [password]);

  const strengthColors = ['', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-emerald-500'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  // Realtime username availability check with debounce
  useEffect(() => {
    if (!username.trim()) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    // Format check
    let formatted = username.trim().toLowerCase();
    if (formatted.startsWith("@")) formatted = formatted.slice(1);
    
    const validFormat = /^[a-z0-9_]{2,19}$/.test(formatted);
    if (!validFormat) {
      setUsernameStatus("invalid");
      setUsernameMessage("2-19 chars: lowercase letters, numbers, underscores only");
      return;
    }

    setUsernameStatus("checking");
    setUsernameMessage("Checking availability...");

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/check-username?username=@${formatted}`);
        if (res.ok) {
          const data = await res.json();
          if (data.available) {
            setUsernameStatus("available");
            setUsernameMessage("Username available");
          } else {
            setUsernameStatus("taken");
            setUsernameMessage("Username already taken");
          }
        } else {
          // If endpoint doesn't exist yet, just show valid format
          setUsernameStatus("available");
          setUsernameMessage("Format valid");
        }
      } catch {
        // Backend may not have this endpoint yet
        setUsernameStatus("available");
        setUsernameMessage("Format valid");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      setIsLoading(false);
      return;
    }

    // Format username
    let formattedUsername = username.trim().toLowerCase();
    if (formattedUsername && !formattedUsername.startsWith("@")) {
      formattedUsername = `@${formattedUsername}`;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: formattedUsername,
          email, 
          password, 
          full_name: fullName 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      loginStore(data.user, data.access_token);
      router.replace("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Connection failure. Backend may be offline.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
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
      setErrorMessage(err.message || "Google sign-up initiation failed.");
      setIsLoading(false);
    }
  };

  const inputBaseClass = "w-full h-12 pl-11 pr-4 rounded-lg bg-[#0a0f1a] border border-white/[0.08] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none text-base text-gray-50 placeholder-gray-600 transition-colors duration-200 font-body";

  return (
    <main className="flex-grow flex items-center justify-center py-16 px-4 relative min-h-screen bg-[#030712]">
      {/* Decorative gradient orb */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-violet-500/[0.06] blur-[120px] -z-10"
      />

      <div className="w-full max-w-lg p-8 rounded-2xl glass-panel relative overflow-hidden">
        {/* Gradient top border */}
        <div
          aria-hidden="true"
          className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-secondary via-tertiary to-primary"
        />

        {/* Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-4 group justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-lg"
            aria-label="Go to FaceSnap home"
          >
            <Camera className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
            <span className="text-lg font-bold tracking-wider text-gray-50 font-display">FaceSnap</span>
          </Link>
          <h2 className="text-2xl font-display font-bold tracking-tight text-gray-50">
            Create Your Account
          </h2>
          <p className="mt-2 text-base text-gray-400 font-body">
            Set up your profile to access the memory retrieval system
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            id="signup-error"
            role="alert"
            aria-live="polite"
            className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400 font-medium leading-relaxed flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label
              htmlFor="signup-fullname"
              className="block text-sm font-medium text-gray-300 mb-1.5 font-body"
            >
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                id="signup-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                aria-invalid={errorMessage ? "true" : undefined}
                aria-describedby={errorMessage ? "signup-error" : undefined}
                className={inputBaseClass}
              />
            </div>
          </div>

          {/* Username with realtime check */}
          <div>
            <label
              htmlFor="signup-username"
              className="block text-sm font-medium text-gray-300 mb-1.5 font-body"
            >
              Username
            </label>
            <div className="relative">
              <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                id="signup-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="janedoe"
                aria-describedby="username-status"
                className={`${inputBaseClass} pr-10 ${
                  usernameStatus === "available" ? "border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/20" :
                  usernameStatus === "taken" || usernameStatus === "invalid" ? "border-rose-500/40 focus:border-rose-500/60 focus:ring-rose-500/20" :
                  ""
                }`}
              />
              {/* Status indicator */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
                {usernameStatus === "available" && <Check className="w-4 h-4 text-emerald-400" />}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && <X className="w-4 h-4 text-rose-400" />}
              </div>
            </div>
            {usernameMessage && (
              <p
                id="username-status"
                className={`mt-1.5 text-xs font-medium ${
                  usernameStatus === "available" ? "text-emerald-400" :
                  usernameStatus === "taken" || usernameStatus === "invalid" ? "text-rose-400" :
                  "text-gray-500"
                }`}
              >
                {usernameStatus === "available" ? "✓ " : usernameStatus === "taken" || usernameStatus === "invalid" ? "✗ " : ""}
                {usernameMessage}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="signup-email"
              className="block text-sm font-medium text-gray-300 mb-1.5 font-body"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@facesnap.ai"
                aria-invalid={errorMessage ? "true" : undefined}
                className={inputBaseClass}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="signup-password"
              className="block text-sm font-medium text-gray-300 mb-1.5 font-body"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                id="signup-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                aria-describedby="password-strength"
                className={inputBaseClass}
              />
            </div>
            {/* Password strength indicator */}
            {password.length > 0 && (
              <div id="password-strength" className="mt-2 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        level <= passwordStrength ? strengthColors[passwordStrength] : 'bg-white/[0.06]'
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-xs font-medium ${
                  passwordStrength <= 1 ? 'text-rose-400' :
                  passwordStrength === 2 ? 'text-amber-400' :
                  passwordStrength === 3 ? 'text-cyan-400' :
                  'text-emerald-400'
                }`}>
                  {strengthLabels[passwordStrength]}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="signup-confirm-password"
              className="block text-sm font-medium text-gray-300 mb-1.5 font-body"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
              <input
                id="signup-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                aria-invalid={passwordsMismatch ? "true" : undefined}
                aria-describedby={passwordsMismatch ? "password-match-error" : undefined}
                className={`${inputBaseClass} pr-10 ${
                  passwordsMatch ? "border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/20" :
                  passwordsMismatch ? "border-rose-500/40 focus:border-rose-500/60 focus:ring-rose-500/20" :
                  ""
                }`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {passwordsMatch && <Check className="w-4 h-4 text-emerald-400" />}
                {passwordsMismatch && <X className="w-4 h-4 text-rose-400" />}
              </div>
            </div>
            {passwordsMismatch && (
              <p id="password-match-error" className="mt-1.5 text-xs font-medium text-rose-400">
                Passwords do not match
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || usernameStatus === "taken" || usernameStatus === "invalid"}
            className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-[#030712] font-semibold text-base rounded-lg font-display transition-all duration-200 mt-6 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712]"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Create Account</span>
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
          onClick={handleGoogleSignup}
          disabled={isLoading}
          className="w-full h-12 flex items-center justify-center bg-[#0d1220] hover:bg-[#12192c] border border-white/[0.08] hover:border-white/[0.15] text-gray-300 hover:text-white font-semibold text-base rounded-lg font-display transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          <span>Google</span>
        </button>


        <p className="mt-8 text-center text-sm text-gray-400 font-body">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded"
          >
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
