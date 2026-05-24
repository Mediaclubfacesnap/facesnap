"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Camera, Mail, Lock, User, Sparkles, Loader2, AtSign, Check, X, AlertCircle, ArrowRight } from "lucide-react";

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
        const res = await fetch(`http://localhost:8000/api/v1/auth/check-username?username=@${formatted}`);
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
      const response = await fetch("http://localhost:8000/api/v1/auth/signup", {
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
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Connection failure. Backend may be offline.");
    } finally {
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
