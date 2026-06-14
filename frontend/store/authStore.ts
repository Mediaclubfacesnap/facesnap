import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string | null;
  platform_role: string;
  can_create_communities: boolean;
  can_create_events: boolean;
  face_matching_enabled?: boolean;
  match_notifications_enabled?: boolean;
  community_discovery_enabled?: boolean;
  hide_matches_from_analytics?: boolean;
  community_match_notifications_enabled?: boolean;
  event_match_notifications_enabled?: boolean;
  weekly_digest_enabled?: boolean;
  email_notifications_enabled?: boolean;
  created_at: string;
}

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  token: string | null; // For backwards compatibility
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (user: UserResponse, accessToken: string) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  const isClient = typeof window !== "undefined";

  // Safe parsing for SSR
  let initialUser: UserResponse | null = null;
  let initialToken: string | null = null;

  if (isClient) {
    const storedUser = localStorage.getItem("facesnap_user");
    const storedToken = localStorage.getItem("facesnap_token");
    initialToken = storedToken;
    if (storedUser) {
      try {
        initialUser = JSON.parse(storedUser);
      } catch {
        localStorage.removeItem("facesnap_user");
      }
    }
  }

  return {
    user: initialUser,
    accessToken: initialToken,
    token: initialToken, // Backwards compatibility
    isAuthenticated: !!initialToken,
    isInitialized: false,

    login: (user, accessToken) => {
      if (isClient) {
        localStorage.setItem("facesnap_user", JSON.stringify(user));
        localStorage.setItem("facesnap_token", accessToken);
        // Store current login timestamp in localStorage for session expiry tracking (5-day limit)
        localStorage.setItem("facesnap_login_time", Date.now().toString());
      }
      set({ user, accessToken, token: accessToken, isAuthenticated: true });
    },

    logout: async () => {
      if (isClient) {
        localStorage.removeItem("facesnap_user");
        localStorage.removeItem("facesnap_token");
        localStorage.removeItem("facesnap_login_time");
      }
      set({ user: null, accessToken: null, token: null, isAuthenticated: false });

      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Error signing out from Supabase:", err);
      }
    },

    initializeAuth: async () => {
      try {
        /*
         * INITIALIZATION SESSION EXPIRY MECHANISM:
         * - Why the timestamp is stored: The 'facesnap_login_time' timestamp is stored in localStorage
         *   on successful login or registration to track when the user session began and enforce
         *   automatic session expiry.
         * - How the 5-day expiry works: On startup and route transitions, we compare 'Date.now()' with
         *   the stored login time. If the duration exceeds SESSION_DURATION (5 days / 432,000,000 ms),
         *   we trigger an automatic session invalidation sequence.
         * - Why Supabase signOut is required: We explicitly call 'supabase.auth.signOut()' to terminate
         *   the server-side session in Supabase, ensuring that the local session and Supabase session
         *   never become out of sync.
         */
        const loginTime = isClient ? localStorage.getItem("facesnap_login_time") : null;
        const SESSION_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
        
        if (loginTime && (Date.now() - Number(loginTime) > SESSION_DURATION)) {
          console.log("Global check: Auth session has expired (5 days exceeded). Cleaning local storage.");
          if (isClient) {
            localStorage.removeItem("facesnap_user");
            localStorage.removeItem("facesnap_token");
            localStorage.removeItem("facesnap_login_time");
          }
          set({ user: null, accessToken: null, token: null, isAuthenticated: false });
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            console.error("Error signing out from Supabase on session expiry:", signOutErr);
          }
          set({ isInitialized: true });
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session) {
          const storedUser = isClient ? localStorage.getItem("facesnap_user") : null;
          const storedToken = isClient ? localStorage.getItem("facesnap_token") : null;

          if (storedUser && storedToken) {
            try {
              set({
                user: JSON.parse(storedUser),
                accessToken: storedToken,
                token: storedToken,
                isAuthenticated: true,
              });
            } catch {
              // Corrupt localStorage data — clear and re-sync from Supabase
              localStorage.removeItem("facesnap_user");
              localStorage.removeItem("facesnap_token");
              set({ isAuthenticated: false, user: null, accessToken: null, token: null });
            }
          } else {
            // Sync session with the FastAPI backend
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/sync-oauth`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Google User",
                avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              if (isClient) {
                localStorage.setItem("facesnap_user", JSON.stringify(data.user));
                localStorage.setItem("facesnap_token", data.access_token);
              }
              set({
                user: data.user,
                accessToken: data.access_token,
                token: data.access_token,
                isAuthenticated: true,
              });
            } else {
              set({ isAuthenticated: false, user: null, accessToken: null, token: null });
            }
          }
        } else {
          set({ isAuthenticated: false, user: null, accessToken: null, token: null });
        }
      } catch (err) {
        console.error("Error during authentication initialization:", err);
        set({ isAuthenticated: false, user: null, accessToken: null, token: null });
      } finally {
        set({ isInitialized: true });
      }
    },

    refreshUser: async () => {
      try {
        const storedToken = isClient ? localStorage.getItem("facesnap_token") : null;
        if (!storedToken) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const freshUser = await res.json();
          if (isClient) {
            localStorage.setItem("facesnap_user", JSON.stringify(freshUser));
          }
          set({ user: freshUser });
        }
      } catch (err) {
        console.error("Error refreshing user data:", err);
      }
    },
  };
});
